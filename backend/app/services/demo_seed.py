import os
import uuid
import shutil
import logging
from sqlalchemy.orm import Session
from app.models.team import Team
from app.models.workspace import Workspace
from app.models.artifact import Artifact
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
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

SUPPORTED_EXTENSIONS = (".vtt", ".pdf", ".docx")

NOTEBOOKS = [
    {
        "name": "PM Team Meetings",
        "folder": os.path.join(SEED_DATA_DIR, "fake_pm_team_meetings"),
        "artifacts": [
            {
                "title": "Action Items by Owner",
                "content_markdown": """# Action Items by Owner
*Extracted from PM Team Meetings (Feb 5 – Feb 26)*

## Priya (Sign)
- [ ] Strengthen business case for developer experience PM req, tie to revenue impact *(Feb 5)*
- [ ] Resolve SBOM signing overlap with Lena — Scan's SBOM output calls Sign's API as optional capability *(Feb 12, due in 1 week)*
- [ ] Write one-paragraph competitive summary: Sigstore vs. Azure Code Signing *(Feb 12)*
- [ ] Finalize Sign strategic narrative: "Make code signing invisible" + enterprise trust layer *(Feb 19)*
- [x] Key rotation GA — 3 success criteria met *(Feb 26)*

## Lena (Scan)
- [ ] Write one-paragraph competitive summary: Snyk vs. Grype *(Feb 12)*
- [ ] Finalize Scan strategic narrative: from "scanner" to "intelligent vulnerability advisor" *(Feb 19)*
- [ ] Target sub-20s p95 scanning by end of Q2 *(Feb 19)*
- [ ] Reduce false positive rate to <3% via reachability analysis (Go first, Java in 2026) *(Feb 19)*
- [x] DB refactor sprint 1 complete *(Feb 26)*
- [x] govulncheck integration reducing false positives by 40% in spike *(Feb 26)*

## Chloe (Release)
- [ ] Propose infra changes digest mechanism with Kenji's team *(Feb 5)*
- [ ] Write one-paragraph competitive summary: GitHub vs. GitLab for deployment *(Feb 12)*
- [ ] Finalize Release strategic narrative: "Enterprise deployment governance" *(Feb 19)*
- [ ] 5 customers in multi-region beta *(Feb 19)*
- [ ] Explore deployment frequency as usage intelligence signal with Diana *(Feb 19)*
- [x] Environment dependencies work ahead of schedule *(Feb 26)*

## Diana (Licensing)
- [ ] Finalize Licensing strategic narrative: "Enterprise control plane" *(Feb 19)*
- [ ] Explore deployment frequency as usage intelligence signal with Chloe *(Feb 19)*
- [x] License transfer wireframes got customer feedback *(Feb 26)*
- [x] Contract management validated with 5 customer interviews *(Feb 26)*

## Raj
- [ ] Prepare credible competitive answer for why Release beats GitHub's native deployment *(Feb 12)*
- [ ] Publish monthly PM write-up in March: GitHub competitive eval *(Feb 26)*

## Fatima
- [x] Published monthly PM write-up: cert expiry copy strategy + 15% renewal lift *(Feb 26)*

## Ben
- [ ] Reframe contract management discovery: job-to-be-done is "renewal anxiety" *(Feb 19)*

## Theo
- [ ] Publish monthly PM write-up in April: govulncheck spike learnings *(Feb 26)*

## All PMs
- [ ] Establish monthly 30-min cross-PM syncs (Sign-Scan, Release-Licensing) *(Feb 5)*
- [ ] Share one-page monthly roadmap summaries to Notion *(Feb 5)*
- [ ] Set up monthly competitive tracking scans (30 min per team) *(Feb 19)*
- [ ] First PM peer feedback session in week 6 — focus on "warm, specific, actionable" *(Feb 12)*

---
*This artifact was auto-generated from meeting transcripts.*
""",
            }
        ],
    },
    {
        "name": "WBR",
        "folder": os.path.join(SEED_DATA_DIR, "fake_transcripts"),
        "artifacts": [],
    },
    {
        "name": "Web Trust Docs",
        "folder": os.path.join(REPO_ROOT, "web_trust_data"),
        "artifacts": [],
    },
    {
        "name": "Artifact Signing Customer Sentiment Analysis",
        "folder": None,
        "artifacts": [],
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

        source_files = sorted(f for f in os.listdir(folder) if f.lower().endswith(SUPPORTED_EXTENSIONS))
        logger.info(f"Seed: importing {len(source_files)} files into '{nb_def['name']}'")

        for filename in source_files:
            src_path = os.path.join(folder, filename)
            file_id = uuid.uuid4().hex[:8]
            dest_path = os.path.join(settings.upload_dir, f"{file_id}_{filename}")
            shutil.copy2(src_path, dest_path)

            source = SourceService.create_from_file(db, dest_path, filename, notebook.id)
            try:
                EmbeddingService.add_source(source.id, source.name, source.content_text or "", notebook.id)
            except Exception as e:
                logger.warning(f"Seed: embedding failed for {filename}: {e}")

        for art_def in nb_def.get("artifacts", []):
            artifact = Artifact(
                workspace_id=notebook.id,
                title=art_def["title"],
                content_markdown=art_def["content_markdown"],
            )
            db.add(artifact)
            db.commit()
            logger.info(f"Seed: created artifact '{art_def['title']}' in '{nb_def['name']}'")
