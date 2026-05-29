"""System Library service.

This module keeps the admin/dev managed document library separate from the
existing user-uploaded Notebook flow. It reads `system_documents`, optional
`system_document_chunks`, and per-user `system_document_bookmarks` from
Supabase. Text queries use library metadata as a safe fallback without returning any hardcoded documents; the API contract is ready for a pgvector RPC backed by `system_document_chunks`.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

from fastapi import HTTPException, status

from app.config import settings
from app.db.supabase_client import supabase
from app.services.chunker import chunk_text
from app.services.document_parser import EmptyDocumentText, UnsupportedDocumentType, parse_document
from app.services.embedder import embed_chunks, embed_query

logger = logging.getLogger(__name__)

SYSTEM_DOCUMENT_COLUMNS = (
    "id, title, filename, file_type, description, ai_summary, page_count, "
    "word_count, difficulty_level, subject_area, tags, access_level, "
    "is_vector_ready, created_at, updated_at"
)

PLAN_RANK = {"free": 0, "pro": 1, "vip": 2}


def _supabase_response_data(resp: Any):
    if isinstance(resp, dict):
        return resp.get("data"), resp.get("error")
    return getattr(resp, "data", None), getattr(resp, "error", None)


def _is_missing_table_error(exc_or_error: Any) -> bool:
    message = str(exc_or_error or "").lower()
    return any(token in message for token in ["system_documents", "system_document_bookmarks", "does not exist", "not find", "schema cache", "relation"])


def _get_user_id(user: dict) -> str:
    user_id = user.get("id") or user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "UNAUTHORIZED", "message": "Token không hợp lệ"})
    return str(user_id)


def get_user_plan(user: dict) -> str:
    """Return subscription plan; placeholder defaults to Free until billing exists."""
    plan = str(user.get("plan") or user.get("subscription_plan") or "free").lower()
    return plan if plan in PLAN_RANK else "free"


def user_can_access(document: dict, user_plan: str) -> bool:
    required = str(document.get("access_level") or "free").lower()
    return PLAN_RANK.get(user_plan, 0) >= PLAN_RANK.get(required, 0)


def normalize_document(row: dict, bookmarked_ids: set[str] | None = None) -> dict:
    bookmarked_ids = bookmarked_ids or set()
    created_at = row.get("created_at")
    is_new = False
    if created_at:
        try:
            dt = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
            is_new = dt >= datetime.now(timezone.utc) - timedelta(days=7)
        except ValueError:
            is_new = False

    tags = row.get("tags") or []
    if isinstance(tags, str):
        tags = [tag.strip() for tag in tags.split(",") if tag.strip()]

    return {
        "id": str(row.get("id")),
        "title": row.get("title") or row.get("filename") or "Tài liệu hệ thống",
        "filename": row.get("filename") or "",
        "description": row.get("description") or "",
        "ai_summary": row.get("ai_summary") or "",
        "page_count": row.get("page_count"),
        "word_count": row.get("word_count"),
        "difficulty_level": row.get("difficulty_level") or "intermediate",
        "subject_area": row.get("subject_area") or "Khác",
        "tags": tags,
        "file_type": row.get("file_type") or "PDF",
        "access_level": str(row.get("access_level") or "free").lower(),
        "is_new": bool(row.get("is_new", is_new)),
        "is_vector_ready": bool(row.get("is_vector_ready", False)),
        "updated_at": row.get("updated_at"),
        "created_at": row.get("created_at"),
        "bookmarked_by_current_user": str(row.get("id")) in bookmarked_ids or bool(row.get("bookmarked_by_current_user", False)),
        "semantic_score": row.get("similarity") or row.get("score"),
    }



def verify_system_library_admin(admin_email: str, admin_password: str) -> None:
    """Validate the simple admin upload account configured in environment."""
    expected_email = (settings.SYSTEM_LIBRARY_ADMIN_EMAIL or "admin").strip()
    expected_password = settings.SYSTEM_LIBRARY_ADMIN_PASSWORD or "admin"
    if admin_email.strip() != expected_email or admin_password != expected_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ADMIN_FORBIDDEN", "message": "Tài khoản admin hoặc mật khẩu admin không đúng"},
        )


def _format_system_file_type(file_type: str) -> str:
    normalized = str(file_type or "").lower()
    if normalized == "pdf":
        return "PDF"
    if normalized == "docx":
        return "DOCX"
    if normalized in {"txt", "md"}:
        return "TXT/MD"
    return normalized.upper() or "FILE"


def _parse_tags(raw_tags: str | list[str] | None) -> list[str]:
    if isinstance(raw_tags, list):
        source = raw_tags
    else:
        source = str(raw_tags or "").replace("#", "").split(",")
    return [tag.strip().replace(" ", "_") for tag in source if tag and tag.strip()]


def _estimate_word_count(pages: list[dict]) -> int:
    text = " ".join(str(page.get("content") or "") for page in pages)
    return len([word for word in text.split() if word.strip()])


async def import_system_document_from_upload(
    *,
    file_contents: bytes,
    filename: str,
    title: str | None = None,
    description: str | None = None,
    ai_summary: str | None = None,
    difficulty_level: str = "intermediate",
    subject_area: str = "Khác",
    tags: str | list[str] | None = None,
    access_level: str = "free",
) -> dict:
    """Parse, chunk, embed, and persist an admin-uploaded System Library document."""
    max_size_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if len(file_contents) > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"code": "FILE_TOO_LARGE", "message": f"File quá lớn. Vui lòng chọn file dưới {settings.MAX_UPLOAD_MB}MB."},
        )

    access = str(access_level or "free").lower()
    if access not in {"free", "pro", "vip"}:
        raise HTTPException(status_code=400, detail={"code": "INVALID_ACCESS_LEVEL", "message": "access_level phải là free, pro hoặc vip"})
    difficulty = str(difficulty_level or "intermediate").lower()
    if difficulty not in {"basic", "intermediate", "advanced"}:
        raise HTTPException(status_code=400, detail={"code": "INVALID_DIFFICULTY", "message": "difficulty_level phải là basic, intermediate hoặc advanced"})

    try:
        pages, parsed_file_type = await parse_document(file_contents, filename)
        chunks = chunk_text(pages)
    except UnsupportedDocumentType as exc:
        raise HTTPException(status_code=400, detail={"code": "INVALID_FILE_TYPE", "message": str(exc)}) from exc
    except EmptyDocumentText as exc:
        raise HTTPException(status_code=400, detail={"code": "PARSE_FAILED", "message": str(exc)}) from exc
    except Exception as exc:
        logger.exception("System document parse/chunk failed")
        raise HTTPException(status_code=500, detail={"code": "PARSE_FAILED", "message": "Không đọc được nội dung văn bản từ file này"}) from exc

    if not chunks:
        raise HTTPException(status_code=400, detail={"code": "PARSE_FAILED", "message": "Không tạo được chunk nội dung từ file này"})

    document_payload = {
        "title": (title or filename).strip(),
        "filename": filename,
        "file_type": _format_system_file_type(parsed_file_type),
        "description": (description or "").strip(),
        "ai_summary": (ai_summary or description or "").strip(),
        "page_count": len(pages),
        "word_count": _estimate_word_count(pages),
        "difficulty_level": difficulty,
        "subject_area": (subject_area or "Khác").strip(),
        "tags": _parse_tags(tags),
        "access_level": access,
        "is_vector_ready": False,
    }

    try:
        resp = supabase.table("system_documents").insert(document_payload).execute()
    except Exception as exc:
        logger.exception("Insert system document metadata failed")
        raise HTTPException(status_code=500, detail={"code": "DB_INSERT_FAILED", "message": "Không thể tạo metadata tài liệu hệ thống"}) from exc
    rows, error = _supabase_response_data(resp)
    if error or not rows:
        raise HTTPException(status_code=500, detail={"code": "DB_INSERT_FAILED", "message": "Không thể tạo metadata tài liệu hệ thống"})

    document_id = str(rows[0]["id"])
    try:
        texts = [chunk["content"] for chunk in chunks]
        embeddings = await embed_chunks(texts)
        chunk_rows = [
            {
                "document_id": document_id,
                "content": chunks[index]["content"],
                "page_start": chunks[index].get("page_number"),
                "page_end": chunks[index].get("page_number"),
                "embedding": "[" + ",".join(map(str, embeddings[index])) + "]",
            }
            for index in range(len(chunks))
        ]
        supabase.table("system_document_chunks").insert(chunk_rows).execute()
        update_resp = supabase.table("system_documents").update({"is_vector_ready": True}).eq("id", document_id).execute()
        updated_rows, update_error = _supabase_response_data(update_resp)
        if update_error:
            raise RuntimeError(update_error)
        source = updated_rows[0] if updated_rows else {**rows[0], "is_vector_ready": True}
    except Exception as exc:
        logger.exception("System document embedding/chunk insert failed")
        try:
            supabase.table("system_documents").delete().eq("id", document_id).execute()
        except Exception:
            logger.warning("Could not rollback failed system document %s", document_id)
        raise HTTPException(status_code=500, detail={"code": "INDEX_FAILED", "message": "Upload thành công nhưng index/vector hóa thất bại"}) from exc

    return normalize_document(source)

def _query_bookmarked_ids(user_id: str) -> set[str]:
    try:
        resp = supabase.table("system_document_bookmarks").select("document_id").eq("user_id", user_id).execute()
    except Exception as exc:
        if _is_missing_table_error(exc):
            return set()
        logger.exception("List system document bookmarks failed")
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": "Lỗi khi lấy tủ sách cá nhân"}) from exc
    rows, error = _supabase_response_data(resp)
    if error:
        if _is_missing_table_error(error):
            return set()
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": "Lỗi khi lấy tủ sách cá nhân"})
    return {str(row.get("document_id")) for row in rows or []}


def _apply_filters(query: Any, filters: dict) -> Any:
    categories = filters.get("categories") or []
    file_types = filters.get("file_types") or []
    access_levels = filters.get("access_levels") or []
    vector_status = filters.get("vector_status") or []
    tags = filters.get("tags") or []
    updated_ranges = filters.get("updated_ranges") or []

    if categories:
        query = query.in_("subject_area", categories)
    if file_types:
        normalized_types = ["TXT" if item == "TXT/MD" else item for item in file_types]
        if "TXT/MD" in file_types:
            normalized_types.extend(["MD", "TXT/MD"])
        query = query.in_("file_type", normalized_types)
    if access_levels:
        query = query.in_("access_level", [str(item).lower() for item in access_levels])
    if len(vector_status) == 1:
        query = query.eq("is_vector_ready", vector_status[0] == "ready")
    if tags:
        query = query.contains("tags", tags)
    if updated_ranges:
        now = datetime.now(timezone.utc)
        if "week" in updated_ranges:
            query = query.gte("updated_at", (now - timedelta(days=7)).isoformat())
        elif "month" in updated_ranges:
            query = query.gte("updated_at", (now - timedelta(days=31)).isoformat())
        elif "year" in updated_ranges:
            query = query.gte("updated_at", (now - timedelta(days=365)).isoformat())
    return query



async def _semantic_ranked_rows(query_text: str, candidate_rows: list[dict]) -> list[dict] | None:
    """Try pgvector semantic ranking via Supabase RPC, or return None for fallback."""
    if not query_text.strip() or not candidate_rows:
        return candidate_rows

    candidate_by_id = {str(row.get("id")): row for row in candidate_rows}

    def _call_rpc(vector: list[float]) -> list[dict]:
        vector_str = "[" + ",".join(map(str, vector)) + "]"
        result = supabase.rpc(
            "match_system_documents",
            {
                "query_embedding": vector_str,
                "match_count": min(100, max(10, len(candidate_rows))),
                "match_threshold": 0,
            },
        ).execute()
        return result.data or []

    try:
        query_vector = await embed_query(query_text)
        matches = await asyncio.to_thread(_call_rpc, query_vector)
    except Exception as exc:
        logger.info("System library semantic RPC unavailable; falling back to metadata search: %s", exc)
        return None

    ranked_rows: list[dict] = []
    seen: set[str] = set()
    for match in matches:
        doc_id = str(match.get("id") or match.get("document_id") or match.get("doc_id"))
        if doc_id in candidate_by_id and doc_id not in seen:
            ranked_rows.append({**candidate_by_id[doc_id], "similarity": match.get("similarity") or match.get("score")})
            seen.add(doc_id)
    return ranked_rows

def _metadata_matches(row: dict, terms: list[str]) -> bool:
    if not terms:
        return True
    haystack = " ".join(
        str(value or "")
        for value in [
            row.get("title"), row.get("filename"), row.get("description"), row.get("ai_summary"), row.get("subject_area"), " ".join(row.get("tags") or []),
        ]
    ).lower()
    return all(term in haystack for term in terms)


async def list_or_search_documents(user: dict, query_text: str = "", filters: dict | None = None) -> dict:
    user_id = _get_user_id(user)
    filters = filters or {}
    bookmarked_ids = _query_bookmarked_ids(user_id)
    bookmarked_only = bool(filters.get("bookmarked"))

    try:
        query = supabase.table("system_documents").select(SYSTEM_DOCUMENT_COLUMNS)
        query = _apply_filters(query, filters)
        if bookmarked_only:
            if not bookmarked_ids:
                return {"documents": [], "total": 0}
            query = query.in_("id", list(bookmarked_ids))
        query = query.order("updated_at", desc=True).limit(100)
        resp = query.execute()
    except Exception as exc:
        if _is_missing_table_error(exc):
            return {"documents": [], "total": 0}
        logger.exception("List system documents failed")
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": "Lỗi khi tải Thư viện Hệ thống"}) from exc

    rows, error = _supabase_response_data(resp)
    if error:
        if _is_missing_table_error(error):
            return {"documents": [], "total": 0}
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": "Lỗi khi tải Thư viện Hệ thống"})

    rows = rows or []
    if str(query_text or "").strip():
        semantic_rows = await _semantic_ranked_rows(str(query_text), rows)
        if semantic_rows is not None:
            rows = semantic_rows
        else:
            terms = [term.lower() for term in str(query_text or "").split() if term.strip()]
            rows = [row for row in rows if _metadata_matches(row, terms)]

    documents = [normalize_document(row, bookmarked_ids) for row in rows]
    return {"documents": documents, "total": len(documents)}


def get_documents_by_ids(document_ids: Iterable[str]) -> list[dict]:
    ids = [str(doc_id) for doc_id in document_ids if doc_id]
    if not ids:
        return []
    try:
        resp = supabase.table("system_documents").select(SYSTEM_DOCUMENT_COLUMNS).in_("id", ids).execute()
    except Exception as exc:
        logger.exception("Get system documents by ids failed")
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": "Lỗi khi tải tài liệu hệ thống"}) from exc
    rows, error = _supabase_response_data(resp)
    if error:
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": "Lỗi khi tải tài liệu hệ thống"})
    return [normalize_document(row) for row in rows or []]


def validate_system_documents_for_chat(document_ids: list[str], user: dict) -> list[dict]:
    docs = get_documents_by_ids(document_ids)
    if len(docs) != len(set(document_ids)):
        raise HTTPException(status_code=404, detail={"code": "DOC_NOT_FOUND", "message": "Không tìm thấy một hoặc nhiều tài liệu hệ thống"})
    user_plan = get_user_plan(user)
    for doc in docs:
        if not doc.get("is_vector_ready"):
            raise HTTPException(status_code=409, detail={"code": "VECTOR_NOT_READY", "message": "Tài liệu chưa sẵn sàng cho AI"})
        if not user_can_access(doc, user_plan):
            raise HTTPException(status_code=403, detail={"code": "PLAN_REQUIRED", "message": "Tài liệu này yêu cầu gói Pro/VIP"})
    return docs


def add_bookmark(document_id: str, user: dict) -> dict:
    user_id = _get_user_id(user)
    docs = get_documents_by_ids([document_id])
    if not docs:
        raise HTTPException(status_code=404, detail={"code": "DOC_NOT_FOUND", "message": "Không tìm thấy tài liệu hệ thống"})
    try:
        resp = supabase.table("system_document_bookmarks").upsert({"user_id": user_id, "document_id": document_id}, on_conflict="user_id,document_id").execute()
    except Exception as exc:
        logger.exception("Bookmark system document failed")
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": "Không thể ghim tài liệu"}) from exc
    _, error = _supabase_response_data(resp)
    if error:
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": "Không thể ghim tài liệu"})
    return {"document_id": document_id, "bookmarked": True}


def remove_bookmark(document_id: str, user: dict) -> dict:
    user_id = _get_user_id(user)
    try:
        resp = supabase.table("system_document_bookmarks").delete().eq("user_id", user_id).eq("document_id", document_id).execute()
    except Exception as exc:
        logger.exception("Unbookmark system document failed")
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": "Không thể bỏ ghim tài liệu"}) from exc
    _, error = _supabase_response_data(resp)
    if error:
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": "Không thể bỏ ghim tài liệu"})
    return {"document_id": document_id, "bookmarked": False}
