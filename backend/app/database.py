"""Conexion y sesion de base de datos (SQLAlchemy 2.0)."""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import get_settings


def _db_url() -> str:
    """Normaliza la URL para SQLAlchemy 2.0 + psycopg3."""
    url = get_settings().database_url
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


_db_url_value = _db_url()

engine = create_engine(
    _db_url_value,
    connect_args=(
        {"check_same_thread": False, "timeout": 5}  # busy_timeout SQLite: commit con lock falla a los 5s
        if "sqlite" in _db_url_value
        else {}
    ),
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()