import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.workspace import Workspace
from app.models.source import Source
from app.models.chat import ChatMessage
from app.models.artifact import Artifact
from app.services.ws_manager import manager
from app.services.embedding_service import EmbeddingService

router = APIRouter()


class WorkspaceCreate(BaseModel):
    name: str = "Untitled Notebook"
    team_id: str | None = None


class WorkspaceRename(BaseModel):
    name: str


@router.get("")
def list_workspaces(team_id: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Workspace)
    if team_id:
        query = query.filter(Workspace.team_id == team_id)
    workspaces = query.order_by(Workspace.created_at.desc()).all()
    return [{"id": w.id, "name": w.name, "created_at": w.created_at} for w in workspaces]


@router.post("")
def create_workspace(body: WorkspaceCreate = WorkspaceCreate(), db: Session = Depends(get_db)):
    workspace = Workspace(id=str(uuid.uuid4()), name=body.name, team_id=body.team_id)
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    return {"id": workspace.id, "name": workspace.name}


@router.get("/{workspace_id}")
def get_workspace(workspace_id: str, db: Session = Depends(get_db)):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return {"id": workspace.id, "name": workspace.name, "created_at": workspace.created_at}


@router.patch("/{workspace_id}")
def rename_workspace(workspace_id: str, body: WorkspaceRename, db: Session = Depends(get_db)):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    workspace.name = body.name
    db.commit()
    db.refresh(workspace)
    return {"id": workspace.id, "name": workspace.name, "created_at": workspace.created_at}


@router.delete("/{workspace_id}")
def delete_workspace(workspace_id: str, db: Session = Depends(get_db)):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    # Delete uploaded files and embeddings for each source
    sources = db.query(Source).filter(Source.workspace_id == workspace_id).all()
    for source in sources:
        if source.file_path and os.path.exists(source.file_path):
            os.remove(source.file_path)
        EmbeddingService.remove_source(source.id)
    # Delete related records
    db.query(Source).filter(Source.workspace_id == workspace_id).delete()
    db.query(ChatMessage).filter(ChatMessage.workspace_id == workspace_id).delete()
    db.query(Artifact).filter(Artifact.workspace_id == workspace_id).delete()
    db.delete(workspace)
    db.commit()
    return {"ok": True}


@router.websocket("/{workspace_id}/ws")
async def workspace_ws(websocket: WebSocket, workspace_id: str):
    await manager.connect(workspace_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(workspace_id, websocket)
