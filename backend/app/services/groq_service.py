import json
import logging
from typing import Any, List

from groq import AsyncGroq

from app.config import settings

logger = logging.getLogger(__name__)


def _client() -> AsyncGroq:
    api_key = (settings.GROQ_API_KEY or "").strip()
    if not api_key or api_key.startswith("your_"):
        raise RuntimeError("Thiếu GROQ_API_KEY hoặc không thể tạo flashcards.")
    return AsyncGroq(api_key=api_key)


def _extract_json(text: str) -> dict[str, Any]:
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        return json.loads(cleaned[start : end + 1])


def _normalize_flashcards(value: Any) -> list[dict[str, str]]:
    cards = value.get("flashcards") if isinstance(value, dict) else value
    if not isinstance(cards, list):
        raise ValueError("Groq response does not contain a flashcards array")
    normalized: list[dict[str, str]] = []
    for card in cards:
        if not isinstance(card, dict):
            continue
        front = str(card.get("front") or "").strip()
        back = str(card.get("back") or "").strip()
        if front and back:
            normalized.append({"front": front, "back": back})
    if not normalized:
        raise ValueError("Groq response did not include usable flashcards")
    return normalized


async def generate_flashcards_from_context(context: str, count: int = 5) -> list[dict[str, str]]:
    if not context.strip():
        raise ValueError("Không có nội dung tài liệu để tạo flashcards.")

    safe_count = max(1, min(int(count or 5), 20))
    prompt = (
        "Tạo flashcards học tập từ ngữ cảnh tài liệu nghiên cứu bên dưới. "
        "Mỗi flashcard phải có front là câu hỏi/khái niệm và back là câu trả lời/giải thích ngắn gọn. "
        "Chỉ trả về JSON hợp lệ, không Markdown, không giải thích ngoài JSON. "
        f"Schema: {{\"flashcards\":[{{\"front\":\"...\",\"back\":\"...\"}}]}}. Số lượng: {safe_count}.\n\n"
        f"Ngữ cảnh:\n{context[:14000]}"
    )
    try:
        response = await _client().chat.completions.create(
            model=settings.GROQ_FLASHCARD_MODEL,
            messages=[
                {"role": "system", "content": "Bạn là trợ lý tạo flashcards. Output JSON only."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or ""
        return _normalize_flashcards(_extract_json(raw))[:safe_count]
    except RuntimeError:
        raise
    except Exception as exc:
        logger.exception("Groq flashcard generation failed")
        raise RuntimeError("Thiếu GROQ_API_KEY hoặc không thể tạo flashcards.") from exc
