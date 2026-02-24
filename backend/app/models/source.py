from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base

class Source(Base):
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    source_type = Column(String(50), nullable=False)  # "docx" or "url"
    url = Column(String(2048), nullable=True)
    file_path = Column(String(512), nullable=True)
    content_text = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
