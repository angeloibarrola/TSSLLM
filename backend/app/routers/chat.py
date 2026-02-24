from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.chat import ChatRequest, ChatMessageResponse
from app.services.chat_service import ChatService

router = APIRouter()

@router.get("", response_model=list[ChatMessageResponse])
def list_messages(db: Session = Depends(get_db)):
    return ChatService.get_messages(db)

@router.post("", response_model=ChatMessageResponse)
def send_message(data: ChatRequest, db: Session = Depends(get_db)):
    try:
        return ChatService.send_message(db, data.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")
