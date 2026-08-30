"""Endpoints de notas (crear, listar, borrar, marcar como sincronizadas)."""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import Note
from ..schemas import NoteCreate, NoteOut, NoteUpdate, SyncOut

router = APIRouter(prefix="/api", tags=["notes"])


def _secret_checked(secret: str) -> None:
    enabled = get_settings().ios_secret
    if enabled and not secret:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="API key requerida")
    if enabled and secret != enabled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="API key invalida")


@router.post("/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(payload: NoteCreate, db: Session = Depends(get_db)) -> Note:
    note = Note(
        title=payload.title,
        body=payload.body,
        ink=payload.ink.model_dump(mode="json") if payload.ink else None,
        reminder_at=payload.reminder_at,
        source=payload.source,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get("/notes", response_model=list[NoteOut])
def list_notes(db: Session = Depends(get_db)) -> list[Note]:
    return list(db.scalars(select(Note).order_by(Note.created_at.desc())))


@router.get("/notes/{note_id}", response_model=NoteOut)
def get_note(note_id: int, db: Session = Depends(get_db)) -> Note:
    note = db.get(Note, note_id)
    if not note:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Nota no encontrada")
    return note


@router.patch("/notes/{note_id}", response_model=NoteOut)
def update_note(
    note_id: int,
    payload: NoteUpdate,
    db: Session = Depends(get_db),
) -> Note:
    """Re-edita una nota (p. ej. guardar nuevo trazo de tinta desde el editor)."""
    note = db.get(Note, note_id)
    if not note:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Nota no encontrada")
    fields = payload.model_dump(mode="json", exclude_unset=True)
    for field, value in fields.items():
        setattr(note, field, value)
    db.commit()
    db.refresh(note)
    return note


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: int, db: Session = Depends(get_db)) -> None:
    note = db.get(Note, note_id)
    if not note:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Nota no encontrada")
    db.delete(note)
    db.commit()


async def sync_secret(x_api_key: str | None = Header(default=None, alias="X-API-Key")):
    _secret_checked(x_api_key or "")


@router.post("/notes/{note_id}/synced", response_model=SyncOut)
def mark_synced(
    note_id: int,
    _: None = Depends(sync_secret),
    db: Session = Depends(get_db),
) -> SyncOut:
    note = db.get(Note, note_id)
    if not note:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Nota no encontrada")
    note.synced_to_ios = True
    db.commit()
    return SyncOut(id=note.id, synced_to_ios=True)