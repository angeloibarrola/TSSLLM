import os
import uuid
import asyncio
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.source import UrlCreate, PasteCreate, SourceResponse, SourceDetailResponse
from app.services.source_service import SourceService
from app.services.embedding_service import EmbeddingService
from app.services.sharepoint_service import SharePointService
from app.config import settings

router = APIRouter()

@router.get("", response_model=list[SourceResponse])
def list_sources(db: Session = Depends(get_db)):
    return SourceService.get_all(db)

@router.get("/sharepoint/status")
def sharepoint_status():
    """Check if user is authenticated to SharePoint."""
    token = SharePointService._get_token()
    return {"authenticated": token is not None}

@router.post("/sharepoint/login")
async def sharepoint_login():
    """Trigger interactive browser auth for SharePoint. Opens a browser window."""
    try:
        token = await asyncio.to_thread(SharePointService.interactive_login)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"SharePoint sign-in failed: {str(e)}")

@router.post("/upload", response_model=SourceResponse)
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith((".docx", ".vtt")):
        raise HTTPException(status_code=400, detail="Only .docx and .vtt files are supported")
    file_id = uuid.uuid4().hex[:8]
    file_path = os.path.join(settings.upload_dir, f"{file_id}_{file.filename}")
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    source = SourceService.create_from_file(db, file_path, file.filename)
    EmbeddingService.add_source(source.id, source.name, source.content_text or "")
    return source

@router.post("/url", response_model=SourceResponse)
async def add_url(data: UrlCreate, db: Session = Depends(get_db)):
    if SharePointService.is_sharepoint_url(data.url):
        token = SharePointService._get_token()
        if not token:
            raise HTTPException(status_code=401, detail="SharePoint not connected. Click 'Connect SharePoint' first.")
        try:
            source = await SourceService.create_from_sharepoint(db, data.url, token)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to fetch SharePoint content: {str(e)}")
    else:
        try:
            source = await SourceService.create_from_url(db, data.url)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {str(e)}")
    EmbeddingService.add_source(source.id, source.name, source.content_text or "")
    return source

@router.post("/paste", response_model=SourceResponse)
def paste_content(data: PasteCreate, db: Session = Depends(get_db)):
    """Add a source by pasting text content directly (e.g. from SharePoint pages)."""
    source = SourceService.create_from_paste(db, data.title, data.content)
    EmbeddingService.add_source(source.id, source.name, source.content_text or "")
    return source

@router.get("/{source_id}", response_model=SourceDetailResponse)
def get_source(source_id: int, db: Session = Depends(get_db)):
    source = SourceService.get_by_id(db, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return source

@router.delete("/{source_id}")
def delete_source(source_id: int, db: Session = Depends(get_db)):
    EmbeddingService.remove_source(source_id)
    if not SourceService.delete(db, source_id):
        raise HTTPException(status_code=404, detail="Source not found")
    return {"ok": True}
