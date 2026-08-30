"""Configuracion de la aplicacion (entorno)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Valores configurables por variables de entorno (.env)."""

    app_name: str = "NoteSync"
    database_url: str = "sqlite:///./notesync.db"
    ios_secret: str = ""  # si se define, protege los endpoints con X-API-Key
    cors_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()