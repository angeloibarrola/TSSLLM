import os
import re
import httpx
from bs4 import BeautifulSoup
from docx import Document
from sqlalchemy.orm import Session
from app.models.source import Source
from app.config import settings

class SourceService:
    @staticmethod
    def parse_vtt(file_path: str) -> str:
        """Parse a WebVTT file, stripping headers, timestamps, and metadata."""
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read()
        # Remove WEBVTT header line (and optional description)
        text = re.sub(r"^WEBVTT[^\n]*\n", "", text)
        # Remove NOTE blocks (NOTE followed by content until blank line)
        text = re.sub(r"NOTE\b[^\n]*\n(?:[^\n]+\n)*\n?", "", text)
        # Remove STYLE blocks
        text = re.sub(r"STYLE\b[^\n]*\n(?:[^\n]+\n)*\n?", "", text)
        # Remove timestamp lines like "00:00:00.000 --> 00:00:05.000" with optional settings
        text = re.sub(r"^[^\n]*\d{2}:\d{2}[\d:.]*\s*-->\s*\d{2}:\d{2}[\d:.]*[^\n]*$", "", text, flags=re.MULTILINE)
        # Remove cue IDs (GUIDs or standalone numbers)
        text = re.sub(r"^[a-f0-9\-]+/\d+-\d+\s*$", "", text, flags=re.MULTILINE)
        text = re.sub(r"^\d+\s*$", "", text, flags=re.MULTILINE)
        # Convert voice tags <v Speaker Name>text</v> → "Speaker Name: text"
        text = re.sub(r"<v\s+([^>]+)>", r"\1: ", text)
        # Strip remaining HTML-like tags (</v>, <b>, etc.)
        text = re.sub(r"<[^>]+>", "", text)
        # Collapse blank lines and clean up
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        # Merge continuation lines and consecutive lines from the same speaker
        merged: list[str] = []
        for line in lines:
            if not merged:
                merged.append(line)
                continue
            prev = merged[-1]
            if ": " in line:
                curr_speaker = line.split(": ", 1)[0]
                if ": " in prev and prev.split(": ", 1)[0] == curr_speaker:
                    # Same speaker — append just the text
                    merged[-1] += " " + line.split(": ", 1)[1]
                else:
                    merged.append(line)
            else:
                # Continuation line (no speaker prefix) — append to previous
                merged[-1] += " " + line
        return "\n\n".join(merged)

    @staticmethod
    def parse_docx(file_path: str) -> str:
        doc = Document(file_path)
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())

    @staticmethod
    async def scrape_url(url: str) -> tuple[str, str]:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0, headers=headers) as client:
            response = await client.get(url)
            response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        title = soup.title.string.strip() if soup.title and soup.title.string else url
        text = soup.get_text(separator="\n", strip=True)
        # Clean up excessive newlines
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return title, "\n\n".join(lines)

    @staticmethod
    def create_from_file(db: Session, file_path: str, original_name: str) -> Source:
        ext = os.path.splitext(original_name)[1].lower()
        if ext == ".vtt":
            content = SourceService.parse_vtt(file_path)
            source_type = "vtt"
        else:
            content = SourceService.parse_docx(file_path)
            source_type = "docx"
        source = Source(
            name=original_name,
            source_type=source_type,
            file_path=file_path,
            content_text=content,
        )
        db.add(source)
        db.commit()
        db.refresh(source)
        return source

    @staticmethod
    async def create_from_url(db: Session, url: str) -> Source:
        title, content = await SourceService.scrape_url(url)
        source = Source(
            name=title,
            source_type="url",
            url=url,
            content_text=content,
        )
        db.add(source)
        db.commit()
        db.refresh(source)
        return source

    @staticmethod
    async def create_from_sharepoint(db: Session, url: str, token: str) -> Source:
        from app.services.sharepoint_service import SharePointService
        title, content = await SharePointService.fetch_content(url, token)
        source = Source(
            name=title,
            source_type="sharepoint",
            url=url,
            content_text=content,
        )
        db.add(source)
        db.commit()
        db.refresh(source)
        return source

    @staticmethod
    def create_from_paste(db: Session, title: str, content: str) -> Source:
        source = Source(
            name=title,
            source_type="paste",
            content_text=content,
        )
        db.add(source)
        db.commit()
        db.refresh(source)
        return source

    @staticmethod
    def get_all(db: Session) -> list[Source]:
        return db.query(Source).order_by(Source.created_at.desc()).all()

    @staticmethod
    def get_by_id(db: Session, source_id: int) -> Source | None:
        return db.query(Source).filter(Source.id == source_id).first()

    @staticmethod
    def delete(db: Session, source_id: int) -> bool:
        source = db.query(Source).filter(Source.id == source_id).first()
        if not source:
            return False
        if source.file_path and os.path.exists(source.file_path):
            os.remove(source.file_path)
        db.delete(source)
        db.commit()
        return True
