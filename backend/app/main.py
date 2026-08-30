"""Entrypoint de la API NoteSync."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import Base, engine
from .routers import notes, reminders

get_settings()  # valida la config al arrancar

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="NoteSync API",
    description="Servicio de notas con recordatorios sincronizables con iPhone "
    "(Atajos/Shortcuts y suscripcion WebCal).",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(notes.router)
app.include_router(reminders.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": get_settings().app_name}