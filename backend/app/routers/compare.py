# @deprecated: Legacy paper-centric endpoints, UI mới không còn gọi trực tiếp.
# TODO: Có thể xóa sau khi xác nhận không còn client nào phụ thuộc.
import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.database import get_db
from app.db.models import Paper, PaperChunk
from app.schemas.chat import CompareRequest
from app.services.comparison_service import compare_papers

router = APIRouter()


@router.post('/papers/compare')
def compare(req: CompareRequest, db: Session = Depends(get_db)):
    if len(req.paper_ids) < 2:
        raise AppError('At least 2 papers are required', 400)
    payload = []
    for pid in req.paper_ids:
        paper = db.query(Paper).filter(Paper.id == pid).first()
        if not paper:
            continue
        chunks = db.query(PaperChunk).filter(PaperChunk.paper_id == pid).order_by(PaperChunk.chunk_index).limit(6).all()
        payload.append({'paper_id': pid, 'title': paper.title, 'context': ' '.join(c.content for c in chunks)[:5000]})
    if len(payload) < 2:
        raise AppError('Not enough valid papers to compare', 400)
    result = compare_papers(payload)
    if 'papers' not in result:
        result['papers'] = [{'paper_id': p['paper_id'], 'title': p['title']} for p in payload]
    return {'comparison': result}
