from datetime import datetime
from pydantic import BaseModel


class PaperOut(BaseModel):
    id: str
    title: str
    filename: str
    status: str
    page_count: int
    chunk_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class UploadResponse(BaseModel):
    paper: PaperOut


class ListPapersResponse(BaseModel):
    papers: list[PaperOut]
