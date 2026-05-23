from datetime import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, Text, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


def uid() -> str:
    return str(uuid.uuid4())


class Paper(Base):
    __tablename__ = 'papers'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    title: Mapped[str] = mapped_column(String)
    filename: Mapped[str] = mapped_column(String)
    file_path: Mapped[str] = mapped_column(String)
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String, default='indexed')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PaperChunk(Base):
    __tablename__ = 'paper_chunks'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    paper_id: Mapped[str] = mapped_column(ForeignKey('papers.id', ondelete='CASCADE'))
    section: Mapped[str] = mapped_column(String, default='Unknown')
    page_start: Mapped[int] = mapped_column(Integer, default=1)
    page_end: Mapped[int] = mapped_column(Integer, default=1)
    content: Mapped[str] = mapped_column(Text)
    chunk_index: Mapped[int] = mapped_column(Integer)
    embedding_json: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PaperSummary(Base):
    __tablename__ = 'paper_summaries'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    paper_id: Mapped[str] = mapped_column(ForeignKey('papers.id', ondelete='CASCADE'), unique=True)
    short_summary: Mapped[str] = mapped_column(Text, default='')
    detailed_summary: Mapped[str] = mapped_column(Text, default='')
    research_problem: Mapped[str] = mapped_column(Text, default='')
    methodology: Mapped[str] = mapped_column(Text, default='')
    main_contributions_json: Mapped[str] = mapped_column(Text, default='[]')
    key_ideas_json: Mapped[str] = mapped_column(Text, default='[]')
    results_json: Mapped[str] = mapped_column(Text, default='[]')
    limitations_json: Mapped[str] = mapped_column(Text, default='[]')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ChatMessage(Base):
    __tablename__ = 'chat_messages'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    paper_id: Mapped[str] = mapped_column(ForeignKey('papers.id', ondelete='CASCADE'))
    role: Mapped[str] = mapped_column(String)
    content: Mapped[str] = mapped_column(Text)
    citations_json: Mapped[str] = mapped_column(Text, default='[]')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
