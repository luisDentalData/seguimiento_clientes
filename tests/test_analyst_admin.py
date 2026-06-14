"""
Tests de administración de analistas + impacto en stats/ETL. Postgres real.
"""
from datetime import datetime

import pytest

from src.models import Analyst, Appointment
from src.services import analyst_admin
from src.services.category_stats import get_category_stats


def _analyst(db, email, name, active=True):
    db.add(Analyst(email=email, name=name, is_active=active))
    db.flush()


def test_list_active_only(db_session):
    _analyst(db_session, "a@dd.es", "A", active=True)
    _analyst(db_session, "b@dd.es", "B", active=False)
    activos = analyst_admin.list_analysts(db_session, active_only=True)
    assert {a.email for a in activos} == {"a@dd.es"}


def test_active_analyst_emails(db_session):
    _analyst(db_session, "a@dd.es", "A", active=True)
    _analyst(db_session, "b@dd.es", "B", active=False)
    assert analyst_admin.active_analyst_emails(db_session) == ["a@dd.es"]


def test_create_analyst(db_session):
    a = analyst_admin.create_analyst(db_session, "Nueva@DD.es", "Nueva Analista")
    db_session.flush()
    assert a.email == "nueva@dd.es"  # normalizado a minúsculas
    assert a.is_active is True


def test_create_email_invalido_falla(db_session):
    with pytest.raises(analyst_admin.AnalystAdminError):
        analyst_admin.create_analyst(db_session, "sin-arroba", "X")


def test_create_duplicado_falla(db_session):
    _analyst(db_session, "a@dd.es", "A")
    with pytest.raises(analyst_admin.DuplicateAnalystError):
        analyst_admin.create_analyst(db_session, "a@dd.es", "Otra")


def test_deactivate(db_session):
    _analyst(db_session, "a@dd.es", "A", active=True)
    analyst_admin.deactivate_analyst(db_session, "a@dd.es")
    db_session.flush()
    assert db_session.get(Analyst, "a@dd.es").is_active is False


def test_deactivate_inexistente_falla(db_session):
    with pytest.raises(analyst_admin.AnalystNotFoundError):
        analyst_admin.deactivate_analyst(db_session, "nope@dd.es")


def test_by_analyst_oculta_inactivas(db_session, client_factory):
    """El desglose por analista NO incluye analistas inactivas (dimensión oculta)."""
    _analyst(db_session, "activa@dd.es", "Activa", active=True)
    _analyst(db_session, "inactiva@dd.es", "Inactiva", active=False)
    db_session.add(Appointment(id="e1", category="CLIENTE", analyst_email="activa@dd.es",
                               start_time=datetime(2025, 11, 1), summary="x", match_status="CONFIRMED"))
    db_session.add(Appointment(id="e2", category="CLIENTE", analyst_email="inactiva@dd.es",
                               start_time=datetime(2025, 11, 1), summary="x", match_status="CONFIRMED"))
    db_session.flush()

    result = get_category_stats(db_session)
    analysts_in_breakdown = {r["analyst"] for r in result["by_analyst"]}
    assert "activa@dd.es" in analysts_in_breakdown
    assert "inactiva@dd.es" not in analysts_in_breakdown
    # PERO el total sigue contando ambas (realidad)
    total = {r["category"]: r["count"] for r in result["total"]}
    assert total["CLIENTE"] == 2
