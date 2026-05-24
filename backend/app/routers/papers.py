# @deprecated: Legacy paper-centric endpoints, UI mới không còn gọi trực tiếp.
# TODO: Có thể xóa sau khi xác nhận không còn client nào phụ thuộc.
import json
from pathlib import Path
import shutil

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError
from app.db.database import get_db
from app.db.models import ChatMessage, Paper, PaperChunk, PaperSummary
from app.schemas.paper import ListPapersResponse, UploadResponse
from app.services.chunk_service import chunk_pages
from app.services.pdf_service import parse_pdf
from app.services.summary_service import build_summary

router = APIRouter()


@router.post('/papers/upload', response_model=UploadResponse)
def upload_paper(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith('.pdf'):
        raise AppError('Only PDF is supported.', 400)
    paper = Paper(title=Path(file.filename).stem, filename=file.filename, file_path='')
    db.add(paper)
    db.flush()
    out_path = Path(settings.upload_dir) / f'{paper.id}_{file.filename}'
    with out_path.open('wb') as f:
        shutil.copyfileobj(file.file, f)
    parsed = parse_pdf(str(out_path))
    chunks = chunk_pages(parsed['pages'])
    paper.file_path = str(out_path)
    paper.page_count = parsed['page_count']
    paper.chunk_count = len(chunks)
    paper.status = 'indexed'
    db.add_all([PaperChunk(paper_id=paper.id, **c) for c in chunks])
    db.commit()
    db.refresh(paper)
    return {'paper': paper}


@router.get('/papers', response_model=ListPapersResponse)
def list_papers(db: Session = Depends(get_db)):
    papers = db.query(Paper).order_by(Paper.created_at.desc()).all()
    return {'papers': papers}


@router.get('/papers/{paper_id}')
def get_paper(paper_id: str, db: Session = Depends(get_db)):
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise AppError('Paper not found', 404)
    summary = db.query(PaperSummary).filter(PaperSummary.paper_id == paper_id).first()
    summary_data = None
    if summary:
        summary_data = {
            'short_summary': summary.short_summary,
            'detailed_summary': summary.detailed_summary,
            'research_problem': summary.research_problem,
            'methodology': summary.methodology,
            'main_contributions': json.loads(summary.main_contributions_json),
            'key_ideas': json.loads(summary.key_ideas_json),
            'results': json.loads(summary.results_json),
            'limitations': json.loads(summary.limitations_json),
        }
    return {'paper': paper, 'summary': summary_data}


@router.delete('/papers/{paper_id}')
def delete_paper(paper_id: str, db: Session = Depends(get_db)):
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise AppError('Paper not found', 404)
    db.query(PaperChunk).filter(PaperChunk.paper_id == paper_id).delete()
    db.query(PaperSummary).filter(PaperSummary.paper_id == paper_id).delete()
    db.query(ChatMessage).filter(ChatMessage.paper_id == paper_id).delete()
    file_path = Path(paper.file_path)
    db.delete(paper)
    db.commit()
    if file_path.exists():
        file_path.unlink(missing_ok=True)
    return {'deleted': True}


@router.post('/papers/{paper_id}/summarize')
def summarize(paper_id: str, db: Session = Depends(get_db)):
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise AppError('Paper not found', 404)
    chunks = db.query(PaperChunk).filter(PaperChunk.paper_id == paper_id).order_by(PaperChunk.chunk_index).all()
    content = '\n'.join(c.content for c in chunks[:16])
    data = build_summary(content)
    current = db.query(PaperSummary).filter(PaperSummary.paper_id == paper_id).first()
    if not current:
      current = PaperSummary(paper_id=paper_id)
    current.short_summary = data.get('short_summary', '')
    current.detailed_summary = data.get('detailed_summary', '')
    current.research_problem = data.get('research_problem', '')
    current.methodology = data.get('methodology', '')
    current.main_contributions_json = json.dumps(data.get('main_contributions', []), ensure_ascii=False)
    current.key_ideas_json = json.dumps(data.get('key_ideas', []), ensure_ascii=False)
    current.results_json = json.dumps(data.get('results', []), ensure_ascii=False)
    current.limitations_json = json.dumps(data.get('limitations', []), ensure_ascii=False)
    db.add(current)
    db.commit()
    return {'paper_id': paper_id, 'summary': data}
