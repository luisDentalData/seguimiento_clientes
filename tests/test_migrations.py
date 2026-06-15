"""
Test de la migración baseline de Alembic.
Corre `alembic upgrade head` sobre una base EFÍMERA y verifica el esquema.
Contra Postgres real (mismo servidor que TEST_DATABASE_URL: local 5434 o CI 5432).
"""
import os

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

# Deriva el servidor de TEST_DATABASE_URL (igual que conftest) en vez de
# hardcodear el puerto local — así funciona tanto en local (5434) como en CI (5432).
_TEST_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+pg8000://postgres:dentaldata@localhost:5434/dentaldata_test",
)
_BASE = _TEST_URL.rsplit("/", 1)[0]
_MIG_DB = "dentaldata_alembic_test"
_ADMIN_URL = f"{_BASE}/postgres"
_MIG_URL = f"{_BASE}/{_MIG_DB}"


def _drop_db(admin_engine):
    with admin_engine.connect() as conn:
        conn.execute(
            text(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                "WHERE datname = :n AND pid <> pg_backend_pid()"
            ),
            {"n": _MIG_DB},
        )
        conn.execute(text(f'DROP DATABASE IF EXISTS "{_MIG_DB}"'))


@pytest.fixture()
def ephemeral_db_url():
    admin = create_engine(_ADMIN_URL, isolation_level="AUTOCOMMIT")
    _drop_db(admin)
    with admin.connect() as conn:
        conn.execute(text(f'CREATE DATABASE "{_MIG_DB}"'))
    try:
        yield _MIG_URL
    finally:
        _drop_db(admin)
        admin.dispose()


def test_baseline_migration_crea_esquema(ephemeral_db_url, monkeypatch):
    monkeypatch.setenv("ALEMBIC_DATABASE_URL", ephemeral_db_url)

    cfg = Config("alembic.ini")
    command.upgrade(cfg, "head")

    engine = create_engine(ephemeral_db_url)
    try:
        insp = inspect(engine)
        tables = set(insp.get_table_names())
        appt_columns = {c["name"] for c in insp.get_columns("appointments")}
    finally:
        engine.dispose()

    assert {"clients", "client_emails", "appointments"}.issubset(tables)
    assert "alembic_version" in tables
    # La migración a1b2c3d4e5f6 agrega la columna category
    assert "category" in appt_columns
