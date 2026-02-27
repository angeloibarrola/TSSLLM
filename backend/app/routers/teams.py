import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.team import Team, _generate_join_code
from app.services.demo_seed import DEMO_TEAM_ID

router = APIRouter()


class TeamCreate(BaseModel):
    name: str = "My Workspace"


class JoinRequest(BaseModel):
    code: str


class TeamRename(BaseModel):
    name: str


@router.post("")
def create_team(body: TeamCreate = TeamCreate(), db: Session = Depends(get_db)):
    # Generate a unique join code (retry on collision)
    for _ in range(10):
        code = _generate_join_code()
        if not db.query(Team).filter(Team.join_code == code).first():
            break
    else:
        raise HTTPException(status_code=500, detail="Failed to generate unique code")

    team = Team(id=str(uuid.uuid4()), name=body.name, join_code=code)
    db.add(team)
    db.commit()
    db.refresh(team)
    return {"id": team.id, "name": team.name, "join_code": team.join_code, "created_at": team.created_at}


@router.get("/demo")
def get_demo_team(db: Session = Depends(get_db)):
    from app.models.workspace import Workspace
    team = db.query(Team).filter(Team.id == DEMO_TEAM_ID).first()
    if not team:
        raise HTTPException(status_code=404, detail="Demo workspace not available")
    pm_notebook = db.query(Workspace).filter(
        Workspace.team_id == DEMO_TEAM_ID, Workspace.name == "PM Team Meetings"
    ).first()
    return {
        "id": team.id, "name": team.name, "join_code": team.join_code,
        "created_at": team.created_at,
        "default_notebook_id": pm_notebook.id if pm_notebook else None,
    }


@router.get("/{team_id}")
def get_team(team_id: str, db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return {"id": team.id, "name": team.name, "join_code": team.join_code, "created_at": team.created_at}


@router.post("/join")
def join_team(body: JoinRequest, db: Session = Depends(get_db)):
    code = body.code.strip().upper()
    team = db.query(Team).filter(Team.join_code == code).first()
    if not team:
        raise HTTPException(status_code=404, detail="Invalid workspace code")
    return {"id": team.id, "name": team.name, "join_code": team.join_code, "created_at": team.created_at}


@router.patch("/{team_id}")
def rename_team(team_id: str, body: TeamRename, db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Workspace not found")
    team.name = body.name
    db.commit()
    db.refresh(team)
    return {"id": team.id, "name": team.name, "join_code": team.join_code, "created_at": team.created_at}
