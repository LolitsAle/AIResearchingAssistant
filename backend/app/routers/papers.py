import json, os, shutil
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.database import get_db
from app.db.models import ChatMessage, Paper, PaperChunk, PaperSummary
from app.schemas.paper import AskRequest, CompareRequest, ExplainTermRequest
from app.services.chunk_service import chunk_pages
from app.services.comparison_service import compare_papers
from app.services.ollama_service import generate_text
from app.services.pdf_service import extract_pdf
from app.services.retrieval_service import retrieve_top_chunks
from app.services.summary_service import generate_structured_summary

router = APIRouter(prefix='/papers', tags=['papers'])

@router.post('/upload')
async def upload_paper(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(400, 'Only PDF files are supported.')
    os.makedirs(settings.upload_dir, exist_ok=True)
    path = os.path.join(settings.upload_dir, file.filename)
    with open(path, 'wb') as out:
        shutil.copyfileobj(file.file, out)
    try:
        parsed = extract_pdf(path)
    except ValueError as e:
        raise HTTPException(422, str(e))
    paper = Paper(title=os.path.splitext(file.filename)[0], filename=file.filename, file_path=path, page_count=parsed['page_count'], status='uploaded')
    db.add(paper); db.flush()
    chunks = chunk_pages(parsed['pages'])
    for c in chunks:
        db.add(PaperChunk(paper_id=paper.id, **c))
    paper.chunk_count = len(chunks); paper.status = 'indexed'
    db.commit(); db.refresh(paper)
    return {'paper': {'id': paper.id, 'title': paper.title, 'filename': paper.filename, 'status': paper.status, 'page_count': paper.page_count, 'chunk_count': paper.chunk_count, 'created_at': paper.created_at}}

@router.get('')
async def list_papers(db: Session = Depends(get_db)):
    papers = db.query(Paper).order_by(Paper.created_at.desc()).all()
    return {'papers': papers}

@router.get('/{paper_id}')
async def get_paper(paper_id: str, db: Session = Depends(get_db)):
    paper = db.get(Paper, paper_id)
    if not paper: raise HTTPException(404, 'Paper not found')
    summ = db.query(PaperSummary).filter_by(paper_id=paper_id).first()
    return {'paper': paper, 'summary': summ}

@router.delete('/{paper_id}')
async def delete_paper(paper_id: str, db: Session = Depends(get_db)):
    paper = db.get(Paper, paper_id)
    if not paper: raise HTTPException(404, 'Paper not found')
    if os.path.exists(paper.file_path): os.remove(paper.file_path)
    db.delete(paper); db.commit(); return {'deleted': True}

@router.post('/{paper_id}/summarize')
async def summarize(paper_id: str, db: Session = Depends(get_db)):
    chunks = db.query(PaperChunk).filter_by(paper_id=paper_id).order_by(PaperChunk.chunk_index.asc()).all()
    if not chunks: raise HTTPException(404, 'Paper not found or not indexed')
    context = '\n\n'.join([c.content for c in chunks[:15]])
    data = await generate_structured_summary(context)
    obj = db.query(PaperSummary).filter_by(paper_id=paper_id).first() or PaperSummary(paper_id=paper_id)
    obj.short_summary = data['short_summary']; obj.detailed_summary = data['detailed_summary']; obj.research_problem = data['research_problem']; obj.methodology = data['methodology']
    obj.main_contributions_json = json.dumps(data['main_contributions']); obj.key_ideas_json = json.dumps(data['key_ideas']); obj.results_json = json.dumps(data['results']); obj.limitations_json = json.dumps(data['limitations'])
    db.add(obj)
    paper = db.get(Paper, paper_id)
    if paper: paper.status = 'summarized'
    db.commit()
    return {'paper_id': paper_id, 'summary': data}

@router.post('/{paper_id}/ask')
async def ask(paper_id: str, req: AskRequest, db: Session = Depends(get_db)):
    if not req.question.strip(): raise HTTPException(400, 'Question must not be empty')
    chunks = db.query(PaperChunk).filter_by(paper_id=paper_id).all()
    ranked = retrieve_top_chunks(req.question, chunks)
    context = '\n\n'.join([f"[{i+1}] {r['chunk'].section} p{r['chunk'].page_start}-{r['chunk'].page_end}: {r['chunk'].content}" for i, r in enumerate(ranked)])
    prompt = f"Answer using only context. If unsure say not enough evidence in paper.\nQuestion: {req.question}\nContext:\n{context}"
    answer = await generate_text(prompt)
    citations = [{'chunk_id': r['chunk'].id,'paper_id': paper_id,'section': r['chunk'].section,'page_start': r['chunk'].page_start,'page_end': r['chunk'].page_end,'snippet': r['chunk'].content[:240],'score': r['score']} for r in ranked]
    db.add(ChatMessage(paper_id=paper_id, role='user', content=req.question, citations_json='[]'))
    db.add(ChatMessage(paper_id=paper_id, role='assistant', content=answer, citations_json=json.dumps(citations)))
    db.commit()
    return {'answer': answer, 'citations': citations}

@router.post('/{paper_id}/terms/explain')
async def explain_term(paper_id: str, req: ExplainTermRequest, db: Session = Depends(get_db)):
    q = f"Explain term: {req.term} in the context of this paper"
    resp = await ask(paper_id, AskRequest(question=q), db)
    return {'term': req.term, 'explanation': resp['answer'], 'citations': resp['citations']}

@router.post('/compare')
async def compare(req: CompareRequest, db: Session = Depends(get_db)):
    if len(req.paper_ids) < 2: raise HTTPException(400, 'At least two paper_ids are required')
    payload = []
    for pid in req.paper_ids:
        p = db.get(Paper, pid)
        if not p: continue
        chunks = db.query(PaperChunk).filter_by(paper_id=pid).order_by(PaperChunk.chunk_index.asc()).limit(5).all()
        payload.append(f"Paper {pid} {p.title}\n" + '\n'.join(c.content[:500] for c in chunks))
    result = await compare_papers('\n\n'.join(payload), req.paper_ids)
    return {'comparison': result}

@router.get('/{paper_id}/chat')
async def chat_history(paper_id: str, db: Session = Depends(get_db)):
    rows = db.query(ChatMessage).filter_by(paper_id=paper_id).order_by(ChatMessage.created_at.asc()).all()
    return {'messages': [{'id': r.id, 'role': r.role, 'content': r.content, 'citations': json.loads(r.citations_json or '[]'), 'created_at': r.created_at} for r in rows]}
