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
SEED_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "seed_data")

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
