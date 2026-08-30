"""Esquemas Pydantic (validacion de entrada/salida)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = ""
    reminder_at: datetime | None = None
    source: str = "web"


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    body: str
    reminder_at: datetime | None
    source: str
    synced_to_ios: bool
    created_at: datetime


class ReminderOut(BaseModel):
    """Shape pensado para el Atajo de iOS / Shortcuts."""

    id: int
    title: str
    body: str
    reminder_at: datetime
    source: str


class SyncOut(BaseModel):
    """Respuesta cuando iOS reporta que se creo el recordatorio."""

    id: int
    synced_to_ios: bool