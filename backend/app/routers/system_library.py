from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.db.supabase_client import supabase
from app.services.system_library_service import (
    add_bookmark,
    import_system_document_from_upload,
    list_or_search_documents,
    remove_bookmark,
    validate_system_documents_for_chat,
    verify_system_library_admin,
    _get_user_id,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["system-library"])


class SystemLibraryFilters(BaseModel):
    categories: list[str] = Field(default_factory=list)
    file_types: list[str] = Field(default_factory=list)
    access_levels: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    updated_ranges: list[str] = Field(default_factory=list)
    vector_status: list[Literal["ready", "processing"]] = Field(default_factory=list)
    bookmarked: bool = False


class SystemLibrarySearchRequest(BaseModel):
    query: str = Field(default="", max_length=500)
    filters: SystemLibraryFilters = Field(default_factory=SystemLibraryFilters)


class SystemLibraryChatSessionRequest(BaseModel):
    document_ids: list[str] = Field(..., min_length=1, max_length=4)
    mode: Literal["single", "compare", "collection"] = "collection"
    title: str | None = Field(default=None, max_length=220)


def _supabase_response_data(resp: Any):
    if isinstance(resp, dict):
        return resp.get("data"), resp.get("error")
    return getattr(resp, "data", None), getattr(resp, "error", None)


@router.get("/documents", response_model=dict)
async def list_documents(
    q: str = "",
    category: str | None = None,
    file_type: str | None = None,
    access_level: str | None = None,
    tags: str | None = None,
    user: dict = Depends(get_current_user),
):
    filters = SystemLibraryFilters(
        categories=[category] if category else [],
        file_types=[file_type] if file_type else [],
        access_levels=[access_level] if access_level else [],
        tags=[tag for tag in (tags or "").split(",") if tag],
    )
    data = await list_or_search_documents(user, q, filters.model_dump())
    return {"success": True, "data": data}


@router.post("/search", response_model=dict)
async def search_documents(body: SystemLibrarySearchRequest, user: dict = Depends(get_current_user)):
    data = await list_or_search_documents(user, body.query, body.filters.model_dump())
    return {"success": True, "data": data}


@router.get("/bookmarks", response_model=dict)
async def list_bookmarks(user: dict = Depends(get_current_user)):
    data = await list_or_search_documents(user, "", {"bookmarked": True})
    return {"success": True, "data": data}


@router.post("/documents/{document_id}/bookmark", response_model=dict)
async def bookmark_document(document_id: str, user: dict = Depends(get_current_user)):
    return {"success": True, "data": add_bookmark(document_id, user)}


@router.delete("/documents/{document_id}/bookmark", response_model=dict)
async def unbookmark_document(document_id: str, user: dict = Depends(get_current_user)):
    return {"success": True, "data": remove_bookmark(document_id, user)}


@router.post("/admin/upload", response_model=dict)
async def upload_system_document(
    file: UploadFile = File(...),
    admin_email: str = Form(...),
    admin_password: str = Form(...),
    title: str | None = Form(default=None),
    description: str | None = Form(default=None),
    ai_summary: str | None = Form(default=None),
    difficulty_level: str = Form(default="intermediate"),
    subject_area: str = Form(default="Khác"),
    tags: str = Form(default=""),
    access_level: str = Form(default="free"),
    user: dict = Depends(get_current_user),
):
    """Admin-only upload that indexes a file directly into `system_documents`."""
    verify_system_library_admin(admin_email, admin_password)
    contents = await file.read()
    document = await import_system_document_from_upload(
        file_contents=contents,
        filename=file.filename or "system-document",
        title=title,
        description=description,
        ai_summary=ai_summary,
        difficulty_level=difficulty_level,
        subject_area=subject_area,
        tags=tags,
        access_level=access_level,
    )
    return {"success": True, "data": {"document": document}}


@router.post("/chat-session", response_model=dict)
async def create_system_library_chat_session(body: SystemLibraryChatSessionRequest, user: dict = Depends(get_current_user)):
    """Create a research session descriptor scoped to system library documents.

    Existing notebook sessions are not modified. The backend validates access level
    and vector readiness here so the frontend cannot bypass Pro/VIP or processing
    constraints. Full mixed-source RAG can read `source_type` and `selected_sources`
    from this session once the chat router is extended to retrieve
    `system_document_chunks`.
    """
    user_id = _get_user_id(user)
    document_ids = [str(doc_id) for doc_id in body.document_ids]
    docs = validate_system_documents_for_chat(document_ids, user)

    if body.mode == "compare" and len(docs) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": "COMPARE_REQUIRES_TWO", "message": "Cần ít nhất 2 tài liệu để so sánh"})

    title_prefix = {
        "single": "Nghiên cứu từ tài liệu hệ thống",
        "compare": "So sánh tài liệu hệ thống",
        "collection": "Chat collection từ Thư viện Hệ thống",
    }[body.mode]
    title = body.title or f"{title_prefix}: {', '.join(doc['title'] for doc in docs[:2])}{'...' if len(docs) > 2 else ''}"
    selected_sources = [{"id": doc["id"], "type": "system_document", "title": doc["title"]} for doc in docs]

    payload = {
        "title": title,
        "selected_document_ids": document_ids,
        "source_type": "system_library",
        "selected_sources": selected_sources,
        "user_id": user_id,
        "is_starred": False,
    }

    try:
        resp = supabase.table("research_sessions").insert(payload).execute()
    except Exception as exc:
        logger.warning("Create system library research session failed; returning descriptor only: %s", exc)
        # Keep endpoint usable before the optional migration is applied; permission
        # and vector checks above still run. No mock document data is returned.
        return {
            "success": True,
            "data": {
                "session": {
                    "id": None,
                    "title": title,
                    "selected_document_ids": document_ids,
                    "source_type": "system_library",
                    "selected_sources": selected_sources,
                    "persisted": False,
                }
            },
        }

    rows, error = _supabase_response_data(resp)
    if error:
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": "Không thể tạo phiên nghiên cứu hệ thống"})
    session = rows[0] if rows else payload
    session.setdefault("source_type", "system_library")
    session.setdefault("selected_sources", selected_sources)
    session["persisted"] = True
    return {"success": True, "data": {"session": session}}
