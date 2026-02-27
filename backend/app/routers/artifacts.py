from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.artifact import ArtifactCreate, ArtifactUpdate, ArtifactResponse
from app.services.artifact_service import ArtifactService
from app.services.ws_manager import manager

router = APIRouter()

@router.get("", response_model=list[ArtifactResponse])
def list_artifacts(workspace_id: str, db: Session = Depends(get_db)):
    return ArtifactService.get_all(db, workspace_id)

@router.get("/{artifact_id}", response_model=ArtifactResponse)
def get_artifact(artifact_id: int, db: Session = Depends(get_db)):
    artifact = ArtifactService.get_by_id(db, artifact_id)
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return artifact

@router.post("", response_model=ArtifactResponse)
async def create_artifact(workspace_id: str, data: ArtifactCreate, db: Session = Depends(get_db)):
    artifact = ArtifactService.create(db, data.title, workspace_id, data.content_markdown)
    await manager.broadcast(workspace_id, "artifacts_changed")
    return artifact

@router.put("/{artifact_id}", response_model=ArtifactResponse)
async def update_artifact(workspace_id: str, artifact_id: int, data: ArtifactUpdate, db: Session = Depends(get_db)):
    artifact = ArtifactService.update(db, artifact_id, data.title, data.content_markdown)
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    await manager.broadcast(workspace_id, "artifacts_changed")
    return artifact

@router.delete("/{artifact_id}")
async def delete_artifact(workspace_id: str, artifact_id: int, db: Session = Depends(get_db)):
    if not ArtifactService.delete(db, artifact_id):
        raise HTTPException(status_code=404, detail="Artifact not found")
    await manager.broadcast(workspace_id, "artifacts_changed")
    return {"ok": True}
