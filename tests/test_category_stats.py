"""
Tests de get_category_stats (carga por categoría). Postgres real.
Cubren: total, por analista, por mes (ignora filtro de mes), filtros y NULL→SIN_CLASIFICAR.
"""
from datetime import datetime

from src.models import Analyst, Appointment
from src.services.category_stats import get_category_stats


def _appt(db, appt_id, category, analyst, when):
    db.add(
        Appointment(
            id=appt_id,
            category=category,
            analyst_email=analyst,
            start_time=when,
            summary="x",
            match_status="CONFIRMED",
        )
    )
    db.flush()


def _seed(db):
    # Analistas activas (necesarias para que aparezcan en el desglose por analista)
    db.add(Analyst(email="a@dd.es", name="Analista A", is_active=True))
    db.add(Analyst(email="b@dd.es", name="Analista B", is_active=True))
    db.flush()
    # Noviembre 2025
    _appt(db, "n1", "CLIENTE", "a@dd.es", datetime(2025, 11, 5))
    _appt(db, "n2", "CLIENTE", "a@dd.es", datetime(2025, 11, 6))
    _appt(db, "n3", "INTERNO", "b@dd.es", datetime(2025, 11, 7))
    _appt(db, "n4", "VACACIONES", "b@dd.es", datetime(2025, 11, 8))
    # Diciembre 2025
    _appt(db, "d1", "CLIENTE", "a@dd.es", datetime(2025, 12, 1))
    _appt(db, "d2", "EVENTO", "b@dd.es", datetime(2025, 12, 2))
    # Sin categoría (NULL) → SIN_CLASIFICAR
    _appt(db, "x1", None, "a@dd.es", datetime(2025, 11, 9))


def _total_map(result):
    return {row["category"]: row["count"] for row in result["total"]}


def test_total_sin_filtros(db_session):
    _seed(db_session)
    total = _total_map(get_category_stats(db_session))
    assert total["CLIENTE"] == 3
    assert total["INTERNO"] == 1
    assert total["VACACIONES"] == 1
    assert total["EVENTO"] == 1
    assert total["SIN_CLASIFICAR"] == 1  # el NULL


def test_total_filtra_por_mes(db_session):
    _seed(db_session)
    total = _total_map(get_category_stats(db_session, month="2025-11"))
    assert total["CLIENTE"] == 2  # n1, n2 (d1 es de diciembre)
    assert "EVENTO" not in total  # EVENTO fue en diciembre


def test_total_filtra_por_analista(db_session):
    _seed(db_session)
    total = _total_map(get_category_stats(db_session, analyst_email="b@dd.es"))
    assert total.get("CLIENTE") is None  # los CLIENTE son de a@dd.es
    assert total["INTERNO"] == 1
    assert total["EVENTO"] == 1


def test_by_analyst_estructura(db_session):
    _seed(db_session)
    result = get_category_stats(db_session)
    by_analyst = {r["analyst"]: r["categories"] for r in result["by_analyst"]}
    assert by_analyst["a@dd.es"]["CLIENTE"] == 3
    assert by_analyst["b@dd.es"]["INTERNO"] == 1


def test_by_month_ignora_filtro_de_mes(db_session):
    _seed(db_session)
    # Aunque filtremos por noviembre, by_month debe traer TODOS los meses.
    result = get_category_stats(db_session, month="2025-11")
    months = {r["month"] for r in result["by_month"]}
    assert "2025-11" in months
    assert "2025-12" in months  # diciembre sigue apareciendo en la serie


def test_by_month_respeta_analista(db_session):
    _seed(db_session)
    result = get_category_stats(db_session, analyst_email="a@dd.es")
    # a@dd.es no tiene EVENTO (es de b@dd.es) en ningún mes
    for row in result["by_month"]:
        assert "EVENTO" not in row["categories"]
