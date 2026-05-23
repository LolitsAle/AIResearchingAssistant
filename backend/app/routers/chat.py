import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.database import get_db
from app.db.models import ChatMessage, Paper, PaperChunk
from app.schemas.chat import AskRequest, ExplainTermRequest
from app.services.ollama_service import ollama_service
from app.services.retrieval_service import retrieve_top_chunks

router = APIRouter()


def _citations(results):
    out = []
    for r in results:
        c = r['chunk']
        out.append({'chunk_id': c.id, 'paper_id': c.paper_id, 'section': c.section, 'page_start': c.page_start, 'page_end': c.page_end, 'snippet': c.content[:280], 'score': r['score']})
    return out


@router.post('/papers/{paper_id}/ask')
def ask(paper_id: str, req: AskRequest, db: Session = Depends(get_db)):
    if not req.question.strip():
        raise AppError('Question is required', 400)
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise AppError('Paper not found', 404)
    chunks = db.query(PaperChunk).filter(PaperChunk.paper_id == paper_id).all()
    top = retrieve_top_chunks(req.question, chunks, 5)
    context = '\n\n'.join([f"[{i+1}] {r['chunk'].content}" for i, r in enumerate(top)])
    prompt = f"Trả lời chỉ dựa trên context sau. Nếu không đủ thì nói rõ không tìm thấy thông tin chắc chắn trong tài liệu.\nContext:\n{context}\n\nCâu hỏi:{req.question}"
    answer = ollama_service.generate_text(prompt)
    cites = _citations(top)
    db.add(ChatMessage(paper_id=paper_id, role='user', content=req.question, citations_json='[]'))
    db.add(ChatMessage(paper_id=paper_id, role='assistant', content=answer, citations_json=json.dumps(cites, ensure_ascii=False)))
    db.commit()
    return {'answer': answer, 'citations': cites}


@router.post('/papers/{paper_id}/terms/explain')
def explain_term(paper_id: str, req: ExplainTermRequest, db: Session = Depends(get_db)):
    if not req.term.strip():
        raise AppError('Term is required', 400)
    chunks = db.query(PaperChunk).filter(PaperChunk.paper_id == paper_id).all()
    top = retrieve_top_chunks(req.term, chunks, 5)
    context = '\n'.join([x['chunk'].content for x in top])
    prompt = f"Giải thích thuật ngữ '{req.term}' cho sinh viên dựa trên paper. Nếu không có thông tin thì nói rõ. Context:\n{context}"
    explanation = ollama_service.generate_text(prompt)
    return {'term': req.term, 'explanation': explanation, 'citations': _citations(top)}


@router.get('/papers/{paper_id}/chat')
def chat_history(paper_id: str, db: Session = Depends(get_db)):
    rows = db.query(ChatMessage).filter(ChatMessage.paper_id == paper_id).order_by(ChatMessage.created_at.asc()).all()
    return {'messages': [{'id': r.id, 'role': r.role, 'content': r.content, 'citations': json.loads(r.citations_json or '[]'), 'created_at': r.created_at} for r in rows]}
