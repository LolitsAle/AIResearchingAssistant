from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.database import get_db
from app.db.models import User, Workspace
from app.services.auth_service import get_current_user

router = APIRouter()


def serialize_workspace(ws: Workspace) -> dict:
    return {
        'id': ws.id,
        'name': ws.name,
        'created_at': ws.created_at,
        'updated_at': ws.updated_at,
    }


@router.get('/workspaces')
def list_workspaces(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(Workspace).filter(Workspace.user_id == current_user.id).order_by(Workspace.updated_at.desc()).all()
    return {'workspaces': [serialize_workspace(w) for w in rows]}


@router.post('/workspaces')
def create_workspace(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    name = (payload.get('name') or 'Workspace mới').strip()
    ws = Workspace(user_id=current_user.id, name=name, active_theme_color=payload.get('active_theme_color') or '#6d5dfc')
    db.add(ws); db.commit(); db.refresh(ws)
    return {'workspace': serialize_workspace(ws)}


@router.get('/workspaces/{workspace_id}')
def get_workspace(workspace_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id, Workspace.user_id == current_user.id).first()
    if not ws:
        raise AppError('Workspace không tồn tại', 404)
    return {'workspace': serialize_workspace(ws)}


@router.patch('/workspaces/{workspace_id}')
def update_workspace(workspace_id: str, payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id, Workspace.user_id == current_user.id).first()
    if not ws:
        raise AppError('Workspace không tồn tại', 404)
    if 'name' in payload:
        ws.name = payload['name']
    if 'active_theme_color' in payload:
        ws.active_theme_color = payload['active_theme_color']
    db.add(ws); db.commit(); db.refresh(ws)
    return {'workspace': serialize_workspace(ws)}


@router.delete('/workspaces/{workspace_id}')
def delete_workspace(workspace_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ws = db.query(Workspace).filter(Workspace.id == workspace_id, Workspace.user_id == current_user.id).first()
    if not ws:
        raise AppError('Workspace không tồn tại', 404)
    db.delete(ws); db.commit()
    return {'deleted': True}
