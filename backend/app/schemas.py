"""Esquemas Pydantic (validacion de entrada/salida)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

# punto de tinta (x, y, presion 0..1) en coordenadas logicas de la pagina
InkPoint = tuple[float, float, float]


class InkStroke(BaseModel):
    tool: Literal["pen", "eraser"] = "pen"
    color: str = "#1e293b"
    width: float = Field(gt=0, le=60)
    points: list[InkPoint] = Field(min_length=1)


class InkPage(BaseModel):
    w: int = Field(gt=0, le=20000)
    h: int = Field(gt=0, le=20000)


class InkData(BaseModel):
    """Nota manuscrita: trazos vectoriales normalizados a la proporcion de pagina."""

    version: Literal[1] = 1
    page: InkPage
    strokes: list[InkStroke] = []

    @model_validator(mode="after")
    def _check_bounds(self) -> "InkData":
        for stroke in self.strokes:
            for x, y, p in stroke.points:
                if not (0 <= x <= self.page.w and 0 <= y <= self.page.h):
                    raise ValueError("punto de tinta fuera de los limites de la pagina")
                if not (0 <= p <= 1):
                    raise ValueError("presion fuera de rango 0..1")
        return self


class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = ""
    ink: InkData | None = None
    reminder_at: datetime | None = None
    source: str = "web"


class NoteUpdate(BaseModel):
    """Campos editables de una nota existente (para guardar la tinta al re-editar)."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = None
    ink: InkData | None = None
    reminder_at: datetime | None = None


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    body: str
    ink: dict | None = None
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