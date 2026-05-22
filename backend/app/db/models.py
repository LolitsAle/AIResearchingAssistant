import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.db.database import Base


def uid():
    return str(uuid.uuid4())


class Paper(Base):
    __tablename__ = 'papers'
    id = Column(String, primary_key=True, default=uid)
    title = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    page_count = Column(Integer, default=0)
    chunk_count = Column(Integer, default=0)
    status = Column(String, default='uploaded')
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    chunks = relationship('PaperChunk', back_populates='paper', cascade='all, delete-orphan')
    summary = relationship('PaperSummary', back_populates='paper', uselist=False, cascade='all, delete-orphan')
    chats = relationship('ChatMessage', back_populates='paper', cascade='all, delete-orphan')


class PaperChunk(Base):
    __tablename__ = 'paper_chunks'
    id = Column(String, primary_key=True, default=uid)
    paper_id = Column(String, ForeignKey('papers.id'), nullable=False)
    section = Column(String, default='Unknown')
    page_start = Column(Integer, default=1)
    page_end = Column(Integer, default=1)
    content = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    embedding_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    paper = relationship('Paper', back_populates='chunks')


class PaperSummary(Base):
    __tablename__ = 'paper_summaries'
    id = Column(String, primary_key=True, default=uid)
    paper_id = Column(String, ForeignKey('papers.id'), unique=True, nullable=False)
    short_summary = Column(Text, default='')
    detailed_summary = Column(Text, default='')
    research_problem = Column(Text, default='')
    methodology = Column(Text, default='')
    main_contributions_json = Column(Text, default='[]')
    key_ideas_json = Column(Text, default='[]')
    results_json = Column(Text, default='[]')
    limitations_json = Column(Text, default='[]')
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    paper = relationship('Paper', back_populates='summary')


class ChatMessage(Base):
    __tablename__ = 'chat_messages'
    id = Column(String, primary_key=True, default=uid)
    paper_id = Column(String, ForeignKey('papers.id'), nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    citations_json = Column(Text, default='[]')
    created_at = Column(DateTime, default=datetime.utcnow)
    paper = relationship('Paper', back_populates='chats')
