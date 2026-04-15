from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True)
    kind = Column(String, nullable=False)
    # kind: transcribe | rewrite | avatar | clip | mashup | pip |
    #       subtitle | cover | bgm | voice | title | compliance | analyze
    status = Column(String, default="queued")  # queued | running | done | failed
    progress = Column(Integer, default=0)
    payload = Column(Text, default="{}")  # JSON input
    result = Column(Text, default="{}")  # JSON output
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Settings(Base):
    __tablename__ = "settings"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=False)
