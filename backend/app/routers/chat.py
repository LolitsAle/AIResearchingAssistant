import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.models.schemas import AskRequest
from app.routers.utils import raise_contract_error, success_response
from app.services.embedder import embed_query
from app.services.llm import generate_answer, generate_answer_stream
from app.services.retriever import retrieve_chunks

router = APIRouter()


@router.post("/ask", response_model=dict)
async def ask(request: AskRequest):
    try:
        query_vector = await embed_query(request.question)
    except Exception:
        raise_contract_error(500, "EMBED_FAILED")

    chunks = await retrieve_chunks(query_vector, request.doc_id)
    if not chunks:
        raise_contract_error(404, "DOC_NOT_FOUND", "Không tìm thấy tài liệu hoặc chưa có dữ liệu")

    try:
        answer = await generate_answer(request.question, chunks, request.chat_history)
    except Exception:
        raise_contract_error(500, "LLM_FAILED")

    sources = [
        {"chunk_id": c["id"], "content": c["content"], "page": c["page_number"], "score": round(c["similarity"], 4)}
        for c in chunks
    ]

    return success_response(
        {
            "answer": answer["text"],
            "sources": sources,
            "tokens_used": answer.get("tokens_used"),
        }
    )


@router.post("/ask/stream")
async def ask_stream(request: AskRequest):
    try:
        query_vector = await embed_query(request.question)
    except Exception:
        raise_contract_error(500, "EMBED_FAILED")

    chunks = await retrieve_chunks(query_vector, request.doc_id)
    if not chunks:
        raise_contract_error(404, "DOC_NOT_FOUND")

    sources = [
        {"chunk_id": c["id"], "content": c["content"], "page": c["page_number"], "score": round(c["similarity"], 4)}
        for c in chunks
    ]

    async def event_generator():
        try:
            yield f"data: {json.dumps({'type': 'sources', 'sources': sources}, ensure_ascii=False)}\n\n"
            async for token in generate_answer_stream(request.question, chunks, request.chat_history):
                yield f"data: {json.dumps({'type': 'token', 'content': token}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
        except Exception:
            yield f"data: {json.dumps({'type': 'error', 'code': 'LLM_FAILED', 'message': 'Lỗi khi gọi Gemini Flash'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
