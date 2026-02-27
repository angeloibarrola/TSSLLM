import os
import uuid
import shutil
import logging
from sqlalchemy.orm import Session
from app.models.team import Team
from app.models.workspace import Workspace
from app.services.source_service import SourceService
from app.services.embedding_service import EmbeddingService
from app.config import settings

logger = logging.getLogger(__name__)

DEMO_TEAM_ID = "00000000-0000-0000-0000-000000000000"

def _resolve_seed_data_dir() -> str:
    """Resolve seed_data directory with fallbacks for Azure runtime."""
    # 1. Explicit env var / config setting (set in Azure App Settings)
    if settings.seed_data_dir:
        return settings.seed_data_dir
    # 2. Relative to __file__ (works for local dev)
    file_based = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "seed_data")
    if os.path.isdir(file_based):
        return file_based
    # 3. Fallback: Azure default deployment path
    azure_fallback = "/home/site/wwwroot/seed_data"
    if os.path.isdir(azure_fallback):
        return azure_fallback
    return file_based  # return original for logging even if missing

SEED_DATA_DIR = _resolve_seed_data_dir()

NOTEBOOKS = [
    {
        "name": "PM Team Meetings",
        "folder": os.path.join(SEED_DATA_DIR, "fake_pm_team_meetings"),
    },
    {
        "name": "WBR",
        "folder": os.path.join(SEED_DATA_DIR, "fake_transcripts"),
    },
    {
        "name": "Artifact Signing Customer Sentiment Analysis",
        "folder": None,
    },
]


def seed_demo_workspace(db: Session) -> None:
    """Create the demo workspace with pre-loaded notebooks. Idempotent."""
    if db.query(Team).filter(Team.id == DEMO_TEAM_ID).first():
        return  # already seeded

    logger.info(f"Seeding demo workspace. SEED_DATA_DIR={SEED_DATA_DIR} exists={os.path.isdir(SEED_DATA_DIR)}")
    if os.path.isdir(SEED_DATA_DIR):
        logger.info(f"Seed data contents: {os.listdir(SEED_DATA_DIR)}")
    else:
        logger.warning(f"Seed data dir missing! __file__={os.path.abspath(__file__)}, cwd={os.getcwd()}")

    team = Team(id=DEMO_TEAM_ID, name="Demo Workspace", join_code="DEMO-0000")
    db.add(team)
    db.commit()

    for nb_def in NOTEBOOKS:
        notebook = Workspace(
            id=str(uuid.uuid4()),
            team_id=DEMO_TEAM_ID,
            name=nb_def["name"],
        )
        db.add(notebook)
        db.commit()
        db.refresh(notebook)

        folder = nb_def["folder"]
        if not folder or not os.path.isdir(folder):
            logger.warning(f"Seed: skipping '{nb_def['name']}' — folder not found: {folder}")
            continue

        vtt_files = sorted(f for f in os.listdir(folder) if f.lower().endswith(".vtt"))
        logger.info(f"Seed: importing {len(vtt_files)} VTT files into '{nb_def['name']}'")

        for filename in vtt_files:
            src_path = os.path.join(folder, filename)
            file_id = uuid.uuid4().hex[:8]
            dest_path = os.path.join(settings.upload_dir, f"{file_id}_{filename}")
            shutil.copy2(src_path, dest_path)

            source = SourceService.create_from_file(db, dest_path, filename, notebook.id)
            try:
                EmbeddingService.add_source(source.id, source.name, source.content_text or "", notebook.id)
            except Exception as e:
                logger.warning(f"Seed: embedding failed for {filename}: {e}")
