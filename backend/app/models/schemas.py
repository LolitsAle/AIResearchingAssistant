from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail


class SuccessEnvelope(BaseModel):
    success: bool = True
    data: Dict[str, Any]


class DocumentResponse(BaseModel):
    doc_id: str
    filename: str
    chunk_count: int
    page_count: int
    created_at: datetime
    status: str = "ready"


class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int


class DeleteDocumentResponse(BaseModel):
    doc_id: str
    deleted: bool


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class AskRequest(BaseModel):
    doc_id: str = Field(min_length=1)
    question: str = Field(min_length=1, max_length=1000)
    chat_history: List[ChatMessage] = Field(default_factory=list)

    @field_validator("question")
    @classmethod
    def validate_question(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("question không được để trống")
        return trimmed

    @model_validator(mode="after")
    def validate_history_limit(self):
        if len(self.chat_history) > 20:
            raise ValueError("chat_history tối đa 20 messages")
        return self


class SourceChunk(BaseModel):
    chunk_id: str
    content: str
    page: int
    score: float


class AskResponse(BaseModel):
    answer: str
    sources: List[SourceChunk]
    tokens_used: Optional[int] = None


class SummaryResponse(BaseModel):
    summary: str
    key_contributions: List[str]
    doc_id: str
