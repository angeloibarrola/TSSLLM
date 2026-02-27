import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    team_id = Column(String(36), ForeignKey("teams.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False, default="Untitled Notebook")
    chat_reset_at = Column(DateTime(timezone=True), nullable=True, default=None)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
