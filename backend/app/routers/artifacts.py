from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.artifact import ArtifactCreate, ArtifactUpdate, ArtifactResponse
from app.services.artifact_service import ArtifactService

router = APIRouter()

@router.get("", response_model=list[ArtifactResponse])
def list_artifacts(db: Session = Depends(get_db)):
    return ArtifactService.get_all(db)

@router.get("/{artifact_id}", response_model=ArtifactResponse)
def get_artifact(artifact_id: int, db: Session = Depends(get_db)):
    artifact = ArtifactService.get_by_id(db, artifact_id)
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return artifact

@router.post("", response_model=ArtifactResponse)
def create_artifact(data: ArtifactCreate, db: Session = Depends(get_db)):
    return ArtifactService.create(db, data.title, data.content_markdown)

@router.put("/{artifact_id}", response_model=ArtifactResponse)
def update_artifact(artifact_id: int, data: ArtifactUpdate, db: Session = Depends(get_db)):
    artifact = ArtifactService.update(db, artifact_id, data.title, data.content_markdown)
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return artifact

@router.delete("/{artifact_id}")
def delete_artifact(artifact_id: int, db: Session = Depends(get_db)):
    if not ArtifactService.delete(db, artifact_id):
        raise HTTPException(status_code=404, detail="Artifact not found")
    return {"ok": True}
