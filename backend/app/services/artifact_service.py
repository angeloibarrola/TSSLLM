from sqlalchemy.orm import Session
from app.models.artifact import Artifact

class ArtifactService:
    @staticmethod
    def get_all(db: Session) -> list[Artifact]:
        return db.query(Artifact).order_by(Artifact.updated_at.desc()).all()

    @staticmethod
    def get_by_id(db: Session, artifact_id: int) -> Artifact | None:
        return db.query(Artifact).filter(Artifact.id == artifact_id).first()

    @staticmethod
    def create(db: Session, title: str, content_markdown: str = "") -> Artifact:
        artifact = Artifact(title=title, content_markdown=content_markdown)
        db.add(artifact)
        db.commit()
        db.refresh(artifact)
        return artifact

    @staticmethod
    def update(db: Session, artifact_id: int, title: str, content_markdown: str) -> Artifact | None:
        artifact = db.query(Artifact).filter(Artifact.id == artifact_id).first()
        if not artifact:
            return None
        artifact.title = title
        artifact.content_markdown = content_markdown
        db.commit()
        db.refresh(artifact)
        return artifact

    @staticmethod
    def delete(db: Session, artifact_id: int) -> bool:
        artifact = db.query(Artifact).filter(Artifact.id == artifact_id).first()
        if not artifact:
            return False
        db.delete(artifact)
        db.commit()
        return True
