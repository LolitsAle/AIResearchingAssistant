"""
Embedding service sử dụng Google Gemini Embedding.
"""
import asyncio
import logging
import time
from google import genai
from google.genai import types
from google.api_core.exceptions import ResourceExhausted
from app.config import settings
from typing import List

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.GOOGLE_API_KEY) if settings.GOOGLE_API_KEY.strip() else None

# Đưa vào settings để dễ thay đổi, không hardcode.
# Google GenAI v1beta does not support every published embedding model on
# embedContent, so keep a safe fallback chain for local env files that still use
# deprecated/unsupported names such as gemini-embedding-002.
EMBEDDING_MODEL = getattr(settings, "EMBEDDING_MODEL", "text-embedding-004")
EMBEDDING_MODEL_FALLBACKS = [
    item.strip()
    for item in str(getattr(settings, "EMBEDDING_MODEL_FALLBACKS", "models/text-embedding-004,embedding-001,models/embedding-001") or "").split(",")
    if item.strip()
]
EMBEDDING_DIMENSIONS = 768  # Phải khớp với schema Supabase: VECTOR(768)
BATCH_SIZE = 100             # Giới hạn của Gemini Embedding API
RATE_LIMIT_SLEEP = 1         # Giây chờ giữa các batch (tránh 429)
MAX_RETRIES = 3              # Số lần retry khi gặp lỗi tạm thời
EMBEDDING_CONCURRENCY = max(1, int(getattr(settings, "EMBEDDING_CONCURRENCY", 1) or 1))


def _embedding_models_to_try() -> List[str]:
    models: List[str] = []
    for model in [EMBEDDING_MODEL, *EMBEDDING_MODEL_FALLBACKS]:
        value = str(model or "").strip()
        if value and value not in models:
            models.append(value)
    return models


def _is_model_not_found_error(exc: Exception) -> bool:
    status_code = getattr(exc, "status_code", None)
    message = str(exc)
    return status_code == 404 or "NOT_FOUND" in message or "not found" in message.lower() or "not supported for embedContent" in message


def _embed_once(batch: List[str], task_type: str, model: str) -> List[List[float]]:
    result = client.models.embed_content(
        model=model,
        contents=batch,
        config=types.EmbedContentConfig(
            task_type=task_type,
            output_dimensionality=EMBEDDING_DIMENSIONS,
        ),
    )
    return [e.values for e in result.embeddings]


def _embed_batch_with_retry(
    batch: List[str],
    task_type: str,
    retries: int = MAX_RETRIES,
) -> List[List[float]]:
    """
    Gọi Gemini Embedding API cho một batch, có retry + fallback model.

    Local/dev env files can drift from the Google GenAI API version. If the
    configured model returns 404/unsupported for embedContent, fail over to the
    configured fallback chain instead of failing the whole indexing job.
    """
    if client is None:
        raise RuntimeError("EMBEDDING_NOT_CONFIGURED: GOOGLE_API_KEY is required for embeddings")

    last_error: Exception = RuntimeError("Unknown embedding error")
    models = _embedding_models_to_try()

    for model_index, model in enumerate(models):
        for attempt in range(retries):
            try:
                if model_index:
                    logger.warning("Embedding model %s failed; retrying with fallback model %s", models[model_index - 1], model)
                return _embed_once(batch, task_type, model)

            except ResourceExhausted as e:
                wait = 60 * (attempt + 1)
                logger.warning("Rate limit embedding model=%s (attempt %s/%s), chờ %ss... — %s", model, attempt + 1, retries, wait, e)
                time.sleep(wait)
                last_error = e

            except Exception as e:
                last_error = e
                if _is_model_not_found_error(e):
                    logger.warning("Embedding model %s is unavailable for embedContent; trying fallback if configured. Error: %s", model, e)
                    break
                wait = 2 ** attempt
                logger.warning("Gemini embedding error model=%s (attempt %s/%s), chờ %ss... — %s", model, attempt + 1, retries, wait, e)
                time.sleep(wait)

    logger.error("Embedding thất bại sau khi thử các model %s: %s", models, last_error)
    raise RuntimeError(f"EMBED_FAILED: {last_error}") from last_error


async def embed_chunks(texts: List[str]) -> List[List[float]]:
    """
    Embed danh sách văn bản (document chunks) theo batch.

    - Batch size: 100 (giới hạn API)
    - Chờ {RATE_LIMIT_SLEEP}s giữa các batch để tránh rate limit
    - Tự động retry khi gặp lỗi tạm thời

    Args:
        texts: Danh sách nội dung chunk cần embed.

    Returns:
        List các vector 768 chiều, thứ tự tương ứng với texts.

    Raises:
        RuntimeError: Khi một batch thất bại sau MAX_RETRIES lần.
    """
    if not texts:
        return []

    total = len(texts)
    batches = [(i, texts[i : i + BATCH_SIZE]) for i in range(0, total, BATCH_SIZE)]
    total_batches = len(batches)
    semaphore = asyncio.Semaphore(EMBEDDING_CONCURRENCY)

    async def _embed_indexed_batch(batch_index: int, batch: List[str]) -> tuple[int, List[List[float]]]:
        async with semaphore:
            logger.info(
                "Embedding batch %s/%s (%s chunks, concurrency=%s)...",
                batch_index + 1,
                total_batches,
                len(batch),
                EMBEDDING_CONCURRENCY,
            )
            result = await asyncio.to_thread(_embed_batch_with_retry, batch, "RETRIEVAL_DOCUMENT")
            if RATE_LIMIT_SLEEP and batch_index + 1 < total_batches and EMBEDDING_CONCURRENCY == 1:
                logger.info("Chờ %ss trước batch tiếp theo...", RATE_LIMIT_SLEEP)
                await asyncio.sleep(RATE_LIMIT_SLEEP)
            return batch_index, result

    completed = await asyncio.gather(
        *(_embed_indexed_batch(batch_index, batch) for batch_index, (_, batch) in enumerate(batches))
    )
    completed.sort(key=lambda item: item[0])
    all_embeddings = [vector for _, batch_vectors in completed for vector in batch_vectors]

    logger.info(f"Embed thành công {total} chunks.")
    return all_embeddings


async def embed_query(text: str) -> List[float]:
    """
    Embed một câu hỏi của user để dùng cho vector search.

    Args:
        text: Câu hỏi cần embed.

    Returns:
        Vector 768 chiều.

    Raises:
        RuntimeError: Khi Gemini API thất bại sau MAX_RETRIES lần.
    """
    if not text or not text.strip():
        raise ValueError("Query text không được để trống.")

    result = await asyncio.to_thread(
        _embed_batch_with_retry, [text], "RETRIEVAL_QUERY"
    )
    return result[0]