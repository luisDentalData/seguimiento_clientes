"""
Infraestructura de tests — Postgres REAL (Docker), NO SQLite.

Estrategia de aislamiento:
- Una base de test dedicada `dentaldata_test` (se crea sola si no existe).
- Cada test corre dentro de una transacción que se revierte al terminar
  (rollback), de modo que la base queda limpia para el siguiente test.

La URL se toma de TEST_DATABASE_URL; por defecto apunta al Postgres de Docker
expuesto en localhost:5434 (ver docker-compose.yml).
"""
import os

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from src.database import Base
from src import models  # noqa: F401  (registra los modelos en Base.metadata)

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+pg8000://postgres:dentaldata@localhost:5434/dentaldata_test",
)


def _maintenance_url(db_url: str, maintenance_db: str = "postgres") -> str:
    """Devuelve la misma URL pero apuntando a la base de mantenimiento."""
    base, _, _name = db_url.rpartition("/")
    return f"{base}/{maintenance_db}"


@pytest.fixture(scope="session")
def engine():
    """Engine de sesión. Crea la base de test y las tablas una sola vez."""
    db_name = TEST_DATABASE_URL.rpartition("/")[2]

    # CREATE DATABASE no puede correr dentro de una transacción → AUTOCOMMIT.
    admin_engine = create_engine(
        _maintenance_url(TEST_DATABASE_URL), isolation_level="AUTOCOMMIT"
    )
    with admin_engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": db_name}
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{db_name}"'))
    admin_engine.dispose()

    eng = create_engine(TEST_DATABASE_URL)
    # Recrear el esquema desde los modelos para que SIEMPRE esté al día
    # (create_all NO agrega columnas nuevas a tablas preexistentes).
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture()
def db_session(engine):
    """Sesión transaccional: cada test se revierte al terminar."""
    connection = engine.connect()
    transaction = connection.begin()
    SessionLocal = sessionmaker(bind=connection, autoflush=False, autocommit=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client_factory(db_session):
    """Factory para sembrar clientes (+ emails) en la base de test."""

    def _make(
        id: str,
        name: str,
        nombre_normalizado: str | None = None,
        nombres_alternativos: list | None = None,
        nombre_contacto: str | None = None,
        emails: list | None = None,
    ):
        client = models.Client(
            id=id,
            name=name,
            nombre_normalizado=nombre_normalizado,
            nombres_alternativos=nombres_alternativos,
            nombre_contacto=nombre_contacto,
        )
        db_session.add(client)
        db_session.flush()
        for email in emails or []:
            db_session.add(models.ClientEmail(client_id=id, email=email))
        db_session.flush()
        return client

    return _make


@pytest.fixture()
def matcher(db_session):
    """Instancia del Matcher bajo prueba, ligada a la sesión de test."""
    from src.services.matching import Matcher

    return Matcher(db_session)
