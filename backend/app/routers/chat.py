from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.chat import ChatRequest, ChatMessageResponse, SuggestionsResponse
from app.services.chat_service import ChatService
from app.services.ws_manager import manager

router = APIRouter()

@router.get("", response_model=list[ChatMessageResponse])
def list_messages(workspace_id: str, db: Session = Depends(get_db)):
    return ChatService.get_messages(db, workspace_id)

@router.get("/suggestions", response_model=SuggestionsResponse)
def get_suggestions(workspace_id: str, db: Session = Depends(get_db)):
    suggestions = ChatService.generate_suggestions(db, workspace_id)
    return SuggestionsResponse(suggestions=suggestions)

@router.post("", response_model=ChatMessageResponse)
async def send_message(workspace_id: str, data: ChatRequest, db: Session = Depends(get_db)):
    try:
        msg = ChatService.send_message(db, data.content, workspace_id, data.source_ids)
        await manager.broadcast(workspace_id, "chat_message")
        return msg
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")
