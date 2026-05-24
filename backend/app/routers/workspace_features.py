import json
from pathlib import Path
import shutil

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError
from app.db.database import get_db
from app.db.models import ChatMessage, Note, Paper, PaperChunk, Setting, Workspace
from app.routers.chat import _citations
from app.services.chunk_service import chunk_pages
from app.services.ollama_service import ollama_service
from app.services.pdf_service import parse_pdf
from app.services.retrieval_service import retrieve_top_chunks

router = APIRouter()

TEMPLATE_MAP = {
    'overview': 'Tổng quan tài liệu', 'deep_summary': 'Tóm tắt chuyên sâu', 'key_arguments': 'Rút trích luận điểm',
    'mind_map': 'Bản đồ tư duy', 'quiz': 'Bài kiểm tra', 'flashcards': 'Flashcards', 'terminology': 'Giải thích thuật ngữ',
    'compare_sources': 'So sánh nhiều nguồn', 'citation_answer': 'Trả lời có trích dẫn', 'data_table': 'Bảng dữ liệu',
}


def serialize_source(doc: Paper) -> dict:
    return {
        'id': doc.id, 'workspace_id': doc.workspace_id, 'title': doc.title, 'filename': doc.filename,
        'status': doc.status, 'page_count': doc.page_count, 'chunk_count': doc.chunk_count,
        'selected': bool(doc.is_selected), 'created_at': doc.created_at,
    }


def serialize_note(note: Note) -> dict:
    return {
        'id': note.id, 'workspace_id': note.workspace_id, 'title': note.title, 'content': note.content,
        'citations': json.loads(note.citations_json or '[]'), 'created_at': note.created_at, 'updated_at': note.updated_at,
    }


@router.get('/settings')
def get_settings(db: Session = Depends(get_db)):
    item = db.query(Setting).first()
    if not item:
        item = Setting(); db.add(item); db.commit(); db.refresh(item)
    return {'theme_mode': item.theme_mode, 'accent_color': item.accent_color}


@router.patch('/settings')
def patch_settings(payload: dict, db: Session = Depends(get_db)):
    item = db.query(Setting).first()
    if not item: item = Setting()
    item.theme_mode = payload.get('theme_mode', item.theme_mode)
    item.accent_color = payload.get('accent_color', item.accent_color)
    db.add(item); db.commit(); db.refresh(item)
    return {'theme_mode': item.theme_mode, 'accent_color': item.accent_color}


@router.get('/workspaces/{workspace_id}/sources')
def get_sources(workspace_id: str, db: Session = Depends(get_db)):
    docs = db.query(Paper).filter(Paper.workspace_id == workspace_id).order_by(Paper.created_at.desc()).all()
    selected_ids = [d.id for d in docs if d.is_selected]
    return {'sources': [serialize_source(d) for d in docs], 'selected_document_ids': selected_ids}


@router.post('/workspaces/{workspace_id}/documents/upload')
def upload_source(workspace_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws: raise AppError('Workspace không tồn tại', 404)
    if not file.filename.lower().endswith('.pdf'): raise AppError('Chỉ hỗ trợ file PDF.', 400)

    paper = Paper(workspace_id=workspace_id, title=Path(file.filename).stem, filename=file.filename, file_path='')
    db.add(paper); db.flush()
    out_path = Path(settings.upload_dir) / f'{paper.id}_{file.filename}'
    with out_path.open('wb') as f: shutil.copyfileobj(file.file, f)

    parsed = parse_pdf(str(out_path)); chunks = chunk_pages(parsed['pages'])
    paper.file_path = str(out_path); paper.page_count = parsed['page_count']; paper.chunk_count = len(chunks); paper.status = 'indexed'; paper.is_selected = 1
    db.add_all([PaperChunk(paper_id=paper.id, **c) for c in chunks]); db.commit(); db.refresh(paper)
    return {'document': serialize_source(paper)}


@router.delete('/documents/{document_id}')
def delete_document(document_id: str, db: Session = Depends(get_db)):
    paper = db.query(Paper).filter(Paper.id == document_id).first()
    if not paper: raise AppError('Không tìm thấy tài liệu', 404)
    file_path = Path(paper.file_path or '')
    db.query(PaperChunk).filter(PaperChunk.paper_id == document_id).delete()
    db.delete(paper); db.commit()
    if file_path.exists(): file_path.unlink(missing_ok=True)
    return {'deleted': True}


@router.patch('/workspaces/{workspace_id}/sources/selection')
def update_selection(workspace_id: str, payload: dict, db: Session = Depends(get_db)):
    selected = set(payload.get('selected_document_ids', []))
    docs = db.query(Paper).filter(Paper.workspace_id == workspace_id).all()
    for d in docs: d.is_selected = 1 if d.id in selected else 0
    db.commit()
    return {'selected_document_ids': list(selected), 'selected_count': len(selected)}


@router.get('/workspaces/{workspace_id}/chat')
def workspace_chat(workspace_id: str, db: Session = Depends(get_db)):
    rows = db.query(ChatMessage).filter(ChatMessage.workspace_id == workspace_id).order_by(ChatMessage.created_at.asc()).all()
    return {'messages': [{'id': r.id, 'workspace_id': workspace_id, 'role': r.role, 'content': r.content, 'citations': json.loads(r.citations_json or '[]'), 'created_at': r.created_at} for r in rows]}


@router.post('/workspaces/{workspace_id}/chat/new')
def new_workspace_chat(workspace_id: str, db: Session = Depends(get_db)):
    db.query(ChatMessage).filter(ChatMessage.workspace_id == workspace_id).delete(); db.commit()
    return {'messages': [], 'message': 'New chat created'}


@router.post('/workspaces/{workspace_id}/chat')
def ask_workspace(workspace_id: str, payload: dict, db: Session = Depends(get_db)):
    question = (payload.get('message') or '').strip()
    selected_ids = payload.get('selected_document_ids', [])
    if not question: raise AppError('Message không được để trống.', 400)
    if not selected_ids: raise AppError('Vui lòng chọn ít nhất một nguồn trước khi hỏi AI.', 400)

    chunks = db.query(PaperChunk).filter(PaperChunk.paper_id.in_(selected_ids)).all()
    top = retrieve_top_chunks(question, chunks, 5)
    context = '\n\n'.join([f"[{i+1}] {r['chunk'].content}" for i, r in enumerate(top)])
    answer = ollama_service.generate_text(f"Trả lời dựa trên context dưới đây bằng tiếng Việt và có cấu trúc rõ ràng.\n\nContext:\n{context}\n\nCâu hỏi: {question}")
    cites = _citations(top)

    db.add(ChatMessage(workspace_id=workspace_id, role='user', content=question, citations_json='[]'))
    assistant_msg = ChatMessage(workspace_id=workspace_id, role='assistant', content=answer, citations_json=json.dumps(cites, ensure_ascii=False))
    db.add(assistant_msg); db.commit(); db.refresh(assistant_msg)

    return {'answer': answer, 'citations': cites, 'message': {'id': assistant_msg.id, 'workspace_id': workspace_id, 'role': 'assistant', 'content': assistant_msg.content, 'citations': cites, 'created_at': assistant_msg.created_at}}


@router.post('/workspaces/{workspace_id}/studio/run')
def run_studio(workspace_id: str, payload: dict, db: Session = Depends(get_db)):
    template = payload.get('template', 'overview')
    ids = payload.get('selected_document_ids', [])
    if not ids: raise AppError('Vui lòng chọn ít nhất một nguồn.', 400)
    prompt_name = TEMPLATE_MAP.get(template, template)
    top = retrieve_top_chunks(prompt_name, db.query(PaperChunk).filter(PaperChunk.paper_id.in_(ids)).all(), 8)
    prompt = f"Hãy tạo đầu ra kiểu {prompt_name} bằng tiếng Việt, có cấu trúc rõ ràng, dựa trên context."
    content = ollama_service.generate_text(prompt + '\n' + '\n'.join([r['chunk'].content for r in top]))
    cites = _citations(top)
    return {'title': f'Studio: {prompt_name}', 'content': content, 'type': 'note', 'citations': cites}


@router.get('/workspaces/{workspace_id}/notes')
def get_notes(workspace_id: str, db: Session = Depends(get_db)):
    rows = db.query(Note).filter(Note.workspace_id == workspace_id).order_by(Note.created_at.desc()).all()
    return {'notes': [serialize_note(n) for n in rows]}


@router.post('/workspaces/{workspace_id}/notes')
def create_note(workspace_id: str, payload: dict, db: Session = Depends(get_db)):
    note = Note(workspace_id=workspace_id, title=payload.get('title') or 'Ghi chú mới', content=payload.get('content') or '', citations_json=json.dumps(payload.get('citations', []), ensure_ascii=False))
    db.add(note); db.commit(); db.refresh(note)
    return {'note': serialize_note(note)}


@router.patch('/notes/{note_id}')
def patch_note(note_id: str, payload: dict, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note: raise AppError('Không tìm thấy ghi chú', 404)
    note.title = payload.get('title', note.title); note.content = payload.get('content', note.content)
    db.add(note); db.commit(); db.refresh(note)
    return {'note': serialize_note(note)}


@router.delete('/notes/{note_id}')
def remove_note(note_id: str, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note: raise AppError('Không tìm thấy ghi chú', 404)
    db.delete(note); db.commit(); return {'deleted': True}


@router.get('/workspaces/{workspace_id}/analytics')
def analytics(workspace_id: str, db: Session = Depends(get_db)):
    docs = db.query(Paper).filter(Paper.workspace_id == workspace_id).all()
    msgs = db.query(ChatMessage).filter(ChatMessage.workspace_id == workspace_id).all()
    notes = db.query(Note).filter(Note.workspace_id == workspace_id).all()
    citation_count = sum(len(json.loads(m.citations_json or '[]')) for m in msgs if m.role == 'assistant')
    return {
        'document_count': len(docs), 'selected_source_count': len([d for d in docs if d.is_selected]), 'chunk_count': sum(d.chunk_count for d in docs),
        'chat_message_count': len(msgs), 'note_count': len(notes), 'citation_count': citation_count,
    }
