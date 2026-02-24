from pydantic import BaseModel
from datetime import datetime

class ArtifactCreate(BaseModel):
    title: str
    content_markdown: str = ""

class ArtifactUpdate(BaseModel):
    title: str
    content_markdown: str

class ArtifactResponse(BaseModel):
    id: int
    title: str
    content_markdown: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
