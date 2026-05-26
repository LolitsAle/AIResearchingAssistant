import google.generativeai as genai

from app.core.config import settings
from app.core.errors import AppError


class GeminiService:
    def __init__(self) -> None:
        if not settings.google_api_key:
            raise AppError('Missing GOOGLE_API_KEY for Gemini service.', 500)
        genai.configure(api_key=settings.google_api_key)
        self.model = genai.GenerativeModel(settings.gemini_model)

    def generate_answer(self, question: str, context: str) -> str:
        prompt = f"""Bạn là trợ lý nghiên cứu. Chỉ trả lời dựa trên context.
Nếu thiếu dữ liệu thì nói rõ chưa đủ bằng chứng.
Context:\n{context}\n\nCâu hỏi: {question}"""
        return self._run(prompt)

    def generate_studio_response(self, template: str, context: str) -> str:
        prompt = f"Hãy tạo nội dung theo mẫu '{template}' bằng tiếng Việt, có cấu trúc rõ ràng, bám sát context sau:\n{context}"
        return self._run(prompt)

    def _run(self, prompt: str) -> str:
        try:
            response = self.model.generate_content(prompt)
            return (response.text or '').strip()
        except Exception as exc:
            raise AppError(f'Gemini API error: {exc}', 502) from exc


gemini_service = GeminiService()
