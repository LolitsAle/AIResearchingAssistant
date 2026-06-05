"""Shared background indexing pipeline for large uploaded documents."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.config import settings
from app.db.supabase_client import supabase
from app.services.chunker import chunk_text
from app.services.document_parser import (
    EmptyDocumentText,
    UnsupportedDocumentType,
    get_file_type,
    parse_document,
    validate_research_file,
)
from app.services.embedder import embed_chunks

logger = logging.getLogger(__name__)
_BACKGROUND_TASKS: set[asyncio.Task] = set()


def _supabase_response_data(resp: Any) -> tuple[Any, Any]:
    if isinstance(resp, dict):
        return resp.get("data"), resp.get("error")
    return getattr(resp, "data", None), getattr(resp, "error", None)


def normalize_citation_threshold(value: Any) -> float:
    try:
        threshold = float(value)
    except (TypeError, ValueError):
        return 0.0
    if threshold != threshold or threshold < 0:
        return 0.0
    return threshold


def parse_tags(raw_tags: str | None) -> list[str]:
    tags: list[str] = []
    for item in str(raw_tags or "").split(","):
        tag = item.strip().lstrip("#").lower()
        if tag and tag not in tags:
            tags.append(tag)
    return tags


def _vector_to_string(vector: list[float] | str | None) -> str:
    if isinstance(vector, str):
        return vector
    return "[" + ",".join(map(str, vector or [])) + "]"


async def _insert_document_payload(payload: dict) -> dict:
    def _call() -> dict:
        try:
            return supabase.table("documents").insert(payload).execute()
        except Exception:
            legacy_payload = dict(payload)
            for optional_key in (
                "file_type",
                "status",
                "processing_status",
                "processing_error",
                "is_vector_ready",
                "citation_threshold",
                "tags",
            ):
                legacy_payload.pop(optional_key, None)
            return supabase.table("documents").insert(legacy_payload).execute()

    resp = await asyncio.to_thread(_call)
    rows, error = _supabase_response_data(resp)
    if error or not rows:
        raise RuntimeError("DB_INSERT_FAILED")
    return rows[0]


async def _update_document(doc_id: str, updates: dict) -> dict | None:
    clean_updates = {key: value for key, value in updates.items() if value is not None}
    if not clean_updates:
        return None

    def _call() -> Any:
        try:
            return supabase.table("documents").update(clean_updates).eq("id", doc_id).execute()
        except Exception:
            legacy_updates = dict(clean_updates)
            for optional_key in ("file_type", "status", "processing_status", "processing_error", "is_vector_ready", "citation_threshold", "tags"):
                legacy_updates.pop(optional_key, None)
            if not legacy_updates:
                return None
            return supabase.table("documents").update(legacy_updates).eq("id", doc_id).execute()

    resp = await asyncio.to_thread(_call)
    if resp is None:
        return None
    rows, error = _supabase_response_data(resp)
    if error:
        raise RuntimeError(error)
    return rows[0] if rows else None


async def _delete_document_chunks(doc_id: str) -> None:
    def _call() -> None:
        supabase.table("document_chunks").delete().eq("doc_id", doc_id).execute()

    await asyncio.to_thread(_call)


async def _insert_chunk_rows(rows: list[dict]) -> None:
    if not rows:
        return
    batch_size = max(1, int(getattr(settings, "INDEX_INSERT_BATCH_SIZE", 250) or 250))

    def _insert_batch(batch: list[dict]) -> None:
        supabase.table("document_chunks").insert(batch).execute()

    for index in range(0, len(rows), batch_size):
        await asyncio.to_thread(_insert_batch, rows[index : index + batch_size])


async def create_queued_notebook_document(
    *,
    notebook_id: str,
    filename: str,
    file_size: int,
    citation_threshold: float | None = 0,
    tags: str = "",
) -> dict:
    """Create a lightweight queued document row and return it immediately to the UI."""
    ext = validate_research_file(filename)
    file_type = ext.lstrip(".") or get_file_type(filename)
    payload = {
        "notebook_id": notebook_id,
        "filename": filename,
        "file_type": file_type,
        "page_count": 0,
        "chunk_count": 0,
        "status": "processing",
        "processing_status": "uploaded",
        "processing_error": None,
        "is_vector_ready": False,
        "citation_threshold": normalize_citation_threshold(citation_threshold),
        "tags": parse_tags(tags),
    }
    row = await _insert_document_payload(payload)
    return {
        "filename": row.get("filename") or filename,
        "doc_id": row["id"],
        "id": row["id"],
        "file_type": row.get("file_type") or file_type,
        "page_count": row.get("page_count") or 0,
        "chunk_count": row.get("chunk_count") or 0,
        "size": file_size,
        "created_at": row.get("created_at"),
        "status": row.get("status") or "processing",
        "processing_status": row.get("processing_status") or "uploaded",
        "processing_error": row.get("processing_error"),
        "is_vector_ready": bool(row.get("is_vector_ready")),
    }


async def index_notebook_document(
    *,
    doc_id: str,
    notebook_id: str,
    filename: str,
    contents: bytes,
    citation_threshold: float | None = 0,
    tags: str = "",
) -> dict:
    """Parse, chunk, embed, and persist vectors for one notebook document."""
    try:
        await _update_document(doc_id, {"status": "processing", "processing_status": "parsing", "processing_error": None, "is_vector_ready": False})
        pages, file_type = await parse_document(contents, filename)
        page_count = len(pages)

        await _update_document(doc_id, {"file_type": file_type, "page_count": page_count, "processing_status": "chunking"})
        chunks = chunk_text(pages)
        if not chunks:
            raise EmptyDocumentText("Không đọc được nội dung văn bản từ file này.")

        await _update_document(doc_id, {"chunk_count": len(chunks), "processing_status": "embedding"})
        texts = [chunk["content"] for chunk in chunks]
        embeddings = await embed_chunks(texts)

        await _delete_document_chunks(doc_id)
        chunk_rows = [
            {
                "doc_id": doc_id,
                "notebook_id": notebook_id,
                "section": chunks[index].get("section", "Unknown"),
                "content": chunks[index]["content"],
                "page_number": chunks[index].get("page_number") or 1,
                "chunk_index": index,
                "embedding": _vector_to_string(embeddings[index]),
            }
            for index in range(len(chunks))
        ]
        await _insert_chunk_rows(chunk_rows)
        updated = await _update_document(
            doc_id,
            {
                "file_type": file_type,
                "page_count": page_count,
                "chunk_count": len(chunks),
                "status": "ready",
                "processing_status": "ready",
                "processing_error": None,
                "is_vector_ready": True,
                "citation_threshold": normalize_citation_threshold(citation_threshold),
                "tags": parse_tags(tags),
            },
        )
        return updated or {"id": doc_id, "status": "ready", "processing_status": "ready", "is_vector_ready": True}
    except (UnsupportedDocumentType, EmptyDocumentText) as exc:
        logger.warning("Notebook document indexing failed for %s: %s", filename, exc)
        await _update_document(doc_id, {"status": "failed", "processing_status": "failed", "processing_error": str(exc), "is_vector_ready": False})
        raise
    except Exception as exc:
        logger.exception("Notebook document indexing failed for %s", filename)
        await _update_document(doc_id, {"status": "failed", "processing_status": "failed", "processing_error": "Không thể index/vector hóa tài liệu.", "is_vector_ready": False})
        raise


def schedule_notebook_indexing(**kwargs: Any) -> asyncio.Task:
    """Start notebook indexing without blocking the upload request."""
    task = asyncio.create_task(index_notebook_document(**kwargs))

    def _log_result(done: asyncio.Task) -> None:
        try:
            done.result()
        except Exception as exc:  # pragma: no cover - background logging only
            logger.warning("Background indexing task finished with error: %s", exc)

    _BACKGROUND_TASKS.add(task)
    task.add_done_callback(_log_result)
    task.add_done_callback(_BACKGROUND_TASKS.discard)
    return task
