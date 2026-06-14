"""
Tests del servicio de portfolio (estado de seguimiento calculado en backend).
Contra Postgres real. `reference_date` fijo => deterministas (sin flakiness).
"""
from datetime import datetime, timedelta

from src.domain.clients.status import ClientStatus
from src.models import Appointment
from src.services.portfolio import get_client_portfolio

REF = datetime(2026, 6, 14, 12, 0, 0)


def _appt(
    db,
    appt_id,
    client_id,
    days_ago,
    status="CONFIRMED",
    is_client=True,
    analyst="a@dentaldata.es",
):
    db.add(
        Appointment(
            id=appt_id,
            matched_client_id=client_id,
            match_status=status,
            is_client_meeting=is_client,
            start_time=REF - timedelta(days=days_ago),
            analyst_email=analyst,
            summary="reunion",
        )
    )
    db.flush()


def _portfolio(db, **kwargs):
    return {e.id: e for e in get_client_portfolio(db, reference_date=REF, **kwargs)}


def test_sesion_reciente_es_ok(db_session, client_factory):
    client_factory(id="CLI_OK", name="Ok Clinic")
    _appt(db_session, "e1", "CLI_OK", days_ago=10)

    e = _portfolio(db_session)["CLI_OK"]
    assert e.status is ClientStatus.OK
    assert e.days_since == 10
    assert e.valid_sessions == 1


def test_sesion_media_es_attention(db_session, client_factory):
    client_factory(id="CLI_AT", name="Att Clinic")
    _appt(db_session, "e1", "CLI_AT", days_ago=45)

    e = _portfolio(db_session)["CLI_AT"]
    assert e.status is ClientStatus.ATTENTION
    assert e.days_since == 45


def test_sesion_vieja_es_critical(db_session, client_factory):
    client_factory(id="CLI_CR", name="Crit Clinic")
    _appt(db_session, "e1", "CLI_CR", days_ago=90)

    e = _portfolio(db_session)["CLI_CR"]
    assert e.status is ClientStatus.CRITICAL
    assert e.days_since == 90


def test_sin_sesiones_validas_es_critical(db_session, client_factory):
    client_factory(id="CLI_NONE", name="Sin Sesiones")

    e = _portfolio(db_session)["CLI_NONE"]
    assert e.status is ClientStatus.CRITICAL
    assert e.last_session is None
    assert e.days_since is None
    assert e.valid_sessions == 0


def test_internal_y_no_match_no_cuentan(db_session, client_factory):
    client_factory(id="CLI_INT", name="Solo Internas")
    _appt(db_session, "e1", "CLI_INT", days_ago=5, status="NO_MATCH", is_client=False)
    _appt(db_session, "e2", "CLI_INT", days_ago=5, status="INTERNAL", is_client=False)

    e = _portfolio(db_session)["CLI_INT"]
    assert e.valid_sessions == 0
    assert e.status is ClientStatus.CRITICAL


def test_probable_cuenta_como_sesion_valida(db_session, client_factory):
    client_factory(id="CLI_PR", name="Probable Clinic")
    _appt(db_session, "e1", "CLI_PR", days_ago=10, status="PROBABLE")

    e = _portfolio(db_session)["CLI_PR"]
    assert e.valid_sessions == 1
    assert e.status is ClientStatus.OK


def test_filtro_por_analista_excluye_sesiones_de_otros(db_session, client_factory):
    client_factory(id="CLI_F", name="Filtrada")
    _appt(db_session, "e1", "CLI_F", days_ago=5, analyst="a@dentaldata.es")

    e = _portfolio(db_session, analyst_email="b@dentaldata.es")["CLI_F"]
    assert e.valid_sessions == 0
    assert e.status is ClientStatus.CRITICAL


def test_last_analyst_es_el_de_la_sesion_mas_reciente(db_session, client_factory):
    client_factory(id="CLI_LA", name="Last Analyst")
    _appt(db_session, "e_old", "CLI_LA", days_ago=30, analyst="viejo@dentaldata.es")
    _appt(db_session, "e_new", "CLI_LA", days_ago=5, analyst="nuevo@dentaldata.es")

    e = _portfolio(db_session)["CLI_LA"]
    assert e.last_analyst == "nuevo@dentaldata.es"
    assert e.days_since == 5
    assert e.valid_sessions == 2


def test_ordena_critical_antes_que_ok(db_session, client_factory):
    client_factory(id="CLI_OK2", name="Reciente")
    _appt(db_session, "e1", "CLI_OK2", days_ago=5)
    client_factory(id="CLI_CRIT", name="Critico")  # sin sesiones → CRITICAL

    entries = get_client_portfolio(db_session, reference_date=REF)
    ids = [e.id for e in entries]
    assert ids.index("CLI_CRIT") < ids.index("CLI_OK2")
