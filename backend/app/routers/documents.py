# @deprecated: Legacy paper-centric endpoints, UI mới không còn gọi trực tiếp.
# TODO: Có thể xóa sau khi xác nhận không còn client nào phụ thuộc.
from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, File, UploadFile

from app.config import settings
from app.db.supabase_client import get_supabase_client
from app.routers.utils import raise_contract_error, success_response
from app.services.chunker import chunk_text
from app.services.embedder import embed_chunks
from app.services.llm import summarize_from_chunks
from app.services.pdf_parser import parse_pdf

router = APIRouter()
MAX_FILE_SIZE = settings.MAX_FILE_SIZE_MB * 1024 * 1024


@router.post("/upload", response_model=dict)
async def upload_document(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise_contract_error(415, "INVALID_FILE_TYPE")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise_contract_error(413, "FILE_TOO_LARGE", f"File vượt quá {settings.MAX_FILE_SIZE_MB}MB")

    try:
        pages = parse_pdf(content)
        if not pages:
            raise_contract_error(422, "PARSE_FAILED")
    except Exception:
        raise_contract_error(422, "PARSE_FAILED")

    chunks = chunk_text(pages)

    try:
        embeddings = await embed_chunks([c["content"] for c in chunks])
    except Exception:
        raise_contract_error(500, "EMBED_FAILED")

    created_at = datetime.now(timezone.utc).isoformat()
    doc_id = str(uuid.uuid4())

    get_supabase_client().table("documents").insert(
        {
            "id": doc_id,
            "filename": file.filename,
            "page_count": len(pages),
            "chunk_count": len(chunks),
            "created_at": created_at,
        }
    ).execute()

    rows = [
        {
            "doc_id": doc_id,
            "content": chunk["content"],
            "page_number": chunk["page"],
            "chunk_index": i,
            "embedding": embeddings[i],
        }
        for i, chunk in enumerate(chunks)
    ]
    if rows:
        get_supabase_client().table("document_chunks").insert(rows).execute()

    return success_response(
        {
            "doc_id": doc_id,
            "filename": file.filename,
            "chunk_count": len(chunks),
            "page_count": len(pages),
            "created_at": created_at,
            "status": "ready",
        }
    )


@router.get("", response_model=dict)
async def list_documents():
    result = get_supabase_client().table("documents").select("*").order("created_at", desc=True).execute()
    docs = [
        {
            "doc_id": d["id"],
            "filename": d["filename"],
            "page_count": d.get("page_count", 0),
            "chunk_count": d.get("chunk_count", 0),
            "created_at": d["created_at"],
        }
        for d in (result.data or [])
    ]
    return success_response({"documents": docs, "total": len(docs)})


@router.delete("/{doc_id}", response_model=dict)
async def delete_document(doc_id: str):
    result = get_supabase_client().table("documents").delete().eq("id", doc_id).execute()
    if not result.data:
        raise_contract_error(404, "DOC_NOT_FOUND")
    return success_response({"doc_id": doc_id, "deleted": True})


@router.post("/{doc_id}/summarize", response_model=dict)
async def summarize_document(doc_id: str):
    doc_result = get_supabase_client().table("documents").select("id").eq("id", doc_id).limit(1).execute()
    if not doc_result.data:
        raise_contract_error(404, "DOC_NOT_FOUND")

    chunks_result = (
        get_supabase_client().table("document_chunks")
        .select("content, page_number")
        .eq("doc_id", doc_id)
        .order("chunk_index")
        .execute()
    )
    chunks = chunks_result.data or []
    if not chunks:
        raise_contract_error(404, "DOC_NOT_FOUND", "Không tìm thấy nội dung tài liệu")

    try:
        summary_data = await summarize_from_chunks(doc_id, chunks)
    except Exception:
        raise_contract_error(500, "LLM_FAILED")

    return success_response(summary_data)
