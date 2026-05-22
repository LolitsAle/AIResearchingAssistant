from datetime import datetime
from pydantic import BaseModel


class ChatMessageOut(BaseModel):
    id: str
    role: str
    content: str
    citations: list
    created_at: datetime
