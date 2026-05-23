from datetime import datetime
from pydantic import BaseModel


class AskRequest(BaseModel):
    question: str


class ExplainTermRequest(BaseModel):
    term: str


class CompareRequest(BaseModel):
    paper_ids: list[str]


class ChatMessageOut(BaseModel):
    id: str
    role: str
    content: str
    citations: list[dict]
    created_at: datetime
