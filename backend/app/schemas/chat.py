from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ChatRequest(BaseModel):
    content: str
    source_ids: Optional[list[int]] = None

class ChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    sources_cited: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class SuggestionsResponse(BaseModel):
    suggestions: list[str]
