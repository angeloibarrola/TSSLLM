import uuid
import random
import string
from sqlalchemy import Column, String, DateTime
from sqlalchemy.sql import func
from app.database import Base


def _generate_join_code() -> str:
    letters = "".join(random.choices(string.ascii_uppercase, k=3))
    digits = "".join(random.choices(string.digits, k=4))
    return f"{letters}-{digits}"


class Team(Base):
    __tablename__ = "teams"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, default="My Workspace")
    join_code = Column(String(10), unique=True, nullable=False, index=True, default=_generate_join_code)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
