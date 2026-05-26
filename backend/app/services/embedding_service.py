import google.generativeai as genai

from app.core.config import settings
from app.core.errors import AppError


class EmbeddingService:
    def __init__(self) -> None:
        if not settings.google_api_key:
            raise AppError('Missing GOOGLE_API_KEY for embedding service.', 500)
        genai.configure(api_key=settings.google_api_key)

    def embed_text(self, text: str) -> list[float]:
        try:
            res = genai.embed_content(model=settings.google_embedding_model, content=text, task_type='retrieval_document')
            return res['embedding']
        except Exception as exc:
            raise AppError(f'Google embedding API error: {exc}', 502) from exc

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [self.embed_text(t) for t in texts]


embedding_service = EmbeddingService()
