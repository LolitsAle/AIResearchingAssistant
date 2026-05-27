import json
from pathlib import Path
import shutil

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError
from app.db.database import get_db
from app.db.models import ChatMessage, Document, DocumentChunk, Note, User, Workspace
from app.services.auth_service import get_current_user
from app.services.chunk_service import chunk_pages
from app.services.embedding_service import embedding_service
from app.services.gemini_service import gemini_service
from app.services.pdf_service import parse_pdf

router = APIRouter()

TEMPLATE_MAP = {
    'deep_summary': 'Tóm tắt tài liệu chuyên sâu', 'key_arguments': 'Rút trích luận điểm chính', 'citation_answer': 'Trả lời có trích dẫn nguồn',
    'terminology': 'Giải thích thuật ngữ khó', 'compare_sources': 'So sánh nhiều nguồn', 'flashcards': 'Tạo flashcards', 'quiz': 'Tạo bài kiểm tra', 'data_table': 'Tạo bảng dữ liệu'
}

def _top_chunks(db: Session, workspace_id: str, selected_ids: list[str], query_embedding: list[float], top_k: int = 5):
    sql = text("""
        SELECT id, document_id, section, page_start, page_end, content, 1 - (embedding <=> CAST(:embedding AS vector)) AS score
        FROM document_chunks
        WHERE workspace_id = :workspace_id AND document_id = ANY(:doc_ids)
        ORDER BY embedding <=> CAST(:embedding AS vector)
        LIMIT :top_k
    """)
    rows = db.execute(sql, {'workspace_id': workspace_id, 'doc_ids': selected_ids, 'embedding': str(query_embedding), 'top_k': top_k}).mappings().all()
    return [dict(r) for r in rows]



def _ensure_workspace_access(db: Session, workspace_id: str, user_id: str) -> Workspace:
    ws = db.query(Workspace).filter(Workspace.id == workspace_id, Workspace.user_id == user_id).first()
    if not ws:
        raise AppError('Workspace không tồn tại', 404)
    return ws

def _citations(rows):
    return [{'chunk_id': r['id'], 'document_id': r['document_id'], 'section': r['section'], 'page_start': r['page_start'], 'page_end': r['page_end'], 'snippet': r['content'][:280], 'score': float(r['score'])} for r in rows]

@router.get('/workspaces/{workspace_id}/sources')
def get_sources(workspace_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_workspace_access(db, workspace_id, current_user.id)
    docs = db.query(Document).filter(Document.workspace_id == workspace_id).order_by(Document.created_at.desc()).all()
    return {'sources': [{'id': d.id, 'workspace_id': d.workspace_id, 'title': d.title, 'filename': d.filename, 'status': d.status, 'page_count': d.page_count, 'chunk_count': d.chunk_count, 'selected': bool(d.is_selected), 'created_at': d.created_at} for d in docs], 'selected_document_ids': [d.id for d in docs if d.is_selected]}

@router.post('/workspaces/{workspace_id}/documents/upload')
def upload_source(workspace_id: str, current_user: User = Depends(get_current_user), file: UploadFile = File(...), db: Session = Depends(get_db)):
    _ensure_workspace_access(db, workspace_id, current_user.id)
    if not file.filename.lower().endswith('.pdf'): raise AppError('Chỉ hỗ trợ file PDF.', 400)
    doc = Document(workspace_id=workspace_id, title=Path(file.filename).stem, filename=file.filename, file_path='')
    db.add(doc); db.flush()
    out_path = Path(settings.upload_dir) / f'{doc.id}_{file.filename}'
    with out_path.open('wb') as f: shutil.copyfileobj(file.file, f)
    parsed = parse_pdf(str(out_path)); chunks = chunk_pages(parsed['pages'])
    vectors = embedding_service.embed_texts([c['content'] for c in chunks])
    db.add_all([DocumentChunk(document_id=doc.id, workspace_id=workspace_id, content=c['content'], page_start=c['page_start'], page_end=c['page_end'], section=c['section'], embedding=vectors[idx]) for idx, c in enumerate(chunks)])
    doc.file_path = str(out_path); doc.page_count = parsed['page_count']; doc.chunk_count = len(chunks); doc.is_selected = 1
    db.commit(); db.refresh(doc)
    return {'document': {'id': doc.id, 'title': doc.title, 'filename': doc.filename, 'status': doc.status, 'page_count': doc.page_count, 'chunk_count': doc.chunk_count, 'selected': True}}

@router.patch('/workspaces/{workspace_id}/sources/selection')
def update_selection(workspace_id: str, payload: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_workspace_access(db, workspace_id, current_user.id)
    selected = set(payload.get('selected_document_ids', [])); docs = db.query(Document).filter(Document.workspace_id == workspace_id).all()
    for d in docs: d.is_selected = 1 if d.id in selected else 0
    db.commit(); return {'selected_document_ids': list(selected), 'selected_count': len(selected)}

@router.post('/workspaces/{workspace_id}/chat')
def ask_workspace(workspace_id: str, payload: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_workspace_access(db, workspace_id, current_user.id)
    question = (payload.get('message') or '').strip(); selected_ids = payload.get('selected_document_ids', [])
    if not question: raise AppError('Message không được để trống.', 400)
    if not selected_ids: raise AppError('Vui lòng chọn ít nhất một nguồn trước khi hỏi AI.', 400)
    qv = embedding_service.embed_text(question); top = _top_chunks(db, workspace_id, selected_ids, qv)
    context = '\n\n'.join([f"[{i+1}] {r['content']}" for i, r in enumerate(top)])
    answer = gemini_service.generate_answer(question, context); cites = _citations(top)
    db.add(ChatMessage(workspace_id=workspace_id, role='user', content=question, citations_json='[]'))
    msg = ChatMessage(workspace_id=workspace_id, role='assistant', content=answer, citations_json=json.dumps(cites, ensure_ascii=False)); db.add(msg); db.commit(); db.refresh(msg)
    return {'message': {'id': msg.id, 'workspace_id': workspace_id, 'role': 'assistant', 'content': msg.content, 'citations': cites, 'created_at': msg.created_at}}

@router.get('/workspaces/{workspace_id}/chat')
def workspace_chat(workspace_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_workspace_access(db, workspace_id, current_user.id)
    rows = db.query(ChatMessage).filter(ChatMessage.workspace_id == workspace_id).order_by(ChatMessage.created_at.asc()).all()
    return {'messages': [{'id': r.id, 'workspace_id': workspace_id, 'role': r.role, 'content': r.content, 'citations': json.loads(r.citations_json or '[]'), 'created_at': r.created_at} for r in rows]}

@router.post('/workspaces/{workspace_id}/chat/new')
def new_workspace_chat(workspace_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_workspace_access(db, workspace_id, current_user.id)
    db.query(ChatMessage).filter(ChatMessage.workspace_id == workspace_id).delete(); db.commit(); return {'messages': []}

@router.post('/workspaces/{workspace_id}/studio/run')
def run_studio(workspace_id: str, payload: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_workspace_access(db, workspace_id, current_user.id)
    template = TEMPLATE_MAP.get(payload.get('template', 'deep_summary'), 'Tóm tắt tài liệu chuyên sâu'); ids = payload.get('selected_document_ids', [])
    if not ids: raise AppError('Vui lòng chọn ít nhất một nguồn.', 400)
    qv = embedding_service.embed_text(template); top = _top_chunks(db, workspace_id, ids, qv, 8)
    content = gemini_service.generate_studio_response(template, '\n'.join([r['content'] for r in top]))
    cites = _citations(top)
    msg = ChatMessage(workspace_id=workspace_id, role='assistant', content=content, citations_json=json.dumps(cites, ensure_ascii=False)); db.add(msg); db.commit(); db.refresh(msg)
    return {'message': {'id': msg.id, 'role': 'assistant', 'content': msg.content, 'citations': cites, 'created_at': msg.created_at}}

@router.get('/workspaces/{workspace_id}/notes')
def get_notes(workspace_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_workspace_access(db, workspace_id, current_user.id)
    rows = db.query(Note).filter(Note.workspace_id == workspace_id).order_by(Note.created_at.desc()).all()
    return {'notes': [{'id': n.id, 'workspace_id': n.workspace_id, 'title': n.title, 'content': n.content, 'citations': json.loads(n.citations_json or '[]'), 'source_message_id': n.source_message_id, 'created_at': n.created_at, 'updated_at': n.updated_at} for n in rows]}

@router.post('/workspaces/{workspace_id}/notes')
def create_note(workspace_id: str, payload: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_workspace_access(db, workspace_id, current_user.id)
    note = Note(workspace_id=workspace_id, title=payload.get('title') or 'Ghi chú từ chat', content=payload.get('content') or '', citations_json=json.dumps(payload.get('citations', []), ensure_ascii=False), source_message_id=payload.get('source_message_id') or '')
    db.add(note); db.commit(); db.refresh(note); return {'note': {'id': note.id, 'workspace_id': note.workspace_id, 'title': note.title, 'content': note.content, 'citations': json.loads(note.citations_json or '[]'), 'source_message_id': note.source_message_id, 'created_at': note.created_at, 'updated_at': note.updated_at}}

@router.patch('/notes/{note_id}')
def patch_note(note_id: str, payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    note = db.query(Note).join(Workspace, Workspace.id == Note.workspace_id).filter(Note.id == note_id, Workspace.user_id == current_user.id).first()
    if not note: raise AppError('Không tìm thấy ghi chú', 404)
    note.title = payload.get('title', note.title); note.content = payload.get('content', note.content)
    db.commit(); db.refresh(note); return {'note': {'id': note.id, 'title': note.title, 'content': note.content}}

@router.delete('/notes/{note_id}')
def remove_note(note_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    note = db.query(Note).join(Workspace, Workspace.id == Note.workspace_id).filter(Note.id == note_id, Workspace.user_id == current_user.id).first()
    if not note: raise AppError('Không tìm thấy ghi chú', 404)
    db.delete(note); db.commit(); return {'deleted': True}


@router.get('/workspaces/{workspace_id}/analytics')
def analytics(workspace_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_workspace_access(db, workspace_id, current_user.id)
    docs = db.query(Document).filter(Document.workspace_id == workspace_id).all()
    msgs = db.query(ChatMessage).filter(ChatMessage.workspace_id == workspace_id).all()
    notes = db.query(Note).filter(Note.workspace_id == workspace_id).all()
    return {'document_count': len(docs), 'selected_source_count': len([d for d in docs if d.is_selected]), 'chat_message_count': len(msgs), 'note_count': len(notes), 'citation_count': sum(len(json.loads(m.citations_json or '[]')) for m in msgs if m.role == 'assistant')}

@router.get('/settings')
def get_settings():
    return {'theme_mode': 'dark', 'accent_color': '#6d5dfc'}

@router.patch('/settings')
def patch_settings(payload: dict):
    return {'theme_mode': payload.get('theme_mode', 'dark'), 'accent_color': payload.get('accent_color', '#6d5dfc')}
