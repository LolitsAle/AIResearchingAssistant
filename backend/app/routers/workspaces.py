from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.database import get_db
from app.db.models import Workspace

router = APIRouter()


@router.get('/workspaces')
def list_workspaces(db: Session = Depends(get_db)):
    return {'workspaces': db.query(Workspace).order_by(Workspace.updated_at.desc()).all()}


@router.post('/workspaces')
def create_workspace(payload: dict, db: Session = Depends(get_db)):
    name = (payload.get('name') or 'Workspace mới').strip()
    ws = Workspace(name=name, active_theme_color=payload.get('active_theme_color') or '#6d5dfc')
    db.add(ws); db.commit(); db.refresh(ws)
    return ws


@router.get('/workspaces/{workspace_id}')
def get_workspace(workspace_id: str, db: Session = Depends(get_db)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise AppError('Workspace không tồn tại', 404)
    return ws


@router.patch('/workspaces/{workspace_id}')
def update_workspace(workspace_id: str, payload: dict, db: Session = Depends(get_db)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise AppError('Workspace không tồn tại', 404)
    if 'name' in payload:
        ws.name = payload['name']
    if 'active_theme_color' in payload:
        ws.active_theme_color = payload['active_theme_color']
    db.add(ws); db.commit(); db.refresh(ws)
    return ws


@router.delete('/workspaces/{workspace_id}')
def delete_workspace(workspace_id: str, db: Session = Depends(get_db)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise AppError('Workspace không tồn tại', 404)
    db.delete(ws); db.commit()
    return {'deleted': True}
