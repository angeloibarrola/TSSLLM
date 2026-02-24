from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class UrlCreate(BaseModel):
    url: str

class PasteCreate(BaseModel):
    title: str
    content: str

class SourceResponse(BaseModel):
    id: int
    name: str
    source_type: str
    url: Optional[str] = None
    file_path: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class SourceDetailResponse(SourceResponse):
    content_text: Optional[str] = None
