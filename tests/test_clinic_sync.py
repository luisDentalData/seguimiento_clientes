"""
Tests de la sincronización SIMÉTRICA de clínicas (src/services/clinic_sync.py).

Fija: replicación simétrica (no importa en qué sede caiga el evento),
idempotencia, multi-sede, exclusión de duplicados como fuente, y el caso real
del bug Maxal (evento en el 2º miembro propaga al 1º). Contra Postgres real.

IDs de cliente con prefijo DD- (como producción) para que la exclusión de
duplicados (`'_DD-' in id`) funcione igual que en el sistema real.
"""
from src.domain.sync.groups import SyncGroup
from src.models import Appointment, ClinicGroup, Client
from src.services.clinic_sync import sync_clinic_groups, build_groups_from_db


def _appt(db, appt_id, client_id, summary="reunion", category="CLIENTE"):
    a = Appointment(
        id=appt_id,
        matched_client_id=client_id,
        match_status="CONFIRMED",
        is_client_meeting=True,
        summary=summary,
        match_reason="motivo original",
        match_confidence=1.0,
        category=category,
        analyst_email="a@dentaldata.es",
    )
    db.add(a)
    db.flush()
    return a


def test_replica_simetrica_a_la_otra_sede(db_session, client_factory):
    client_factory(id="DD-90001", name="Sede A")
    client_factory(id="DD-90002", name="Sede B")
    _appt(db_session, "e1", "DD-90001")

    groups = [SyncGroup("G", (("DD-90001", "A"), ("DD-90002", "B")))]
    sync_clinic_groups(db_session, groups)
    db_session.flush()

    dup = db_session.get(Appointment, "e1_DD-90002")
    assert dup is not None
    assert dup.matched_client_id == "DD-90002"
    assert dup.match_reason.startswith("[B]")


def test_bug_maxal_evento_en_segundo_miembro_propaga_al_primero(db_session, client_factory):
    """EL BUG: el matcher asignó el evento a la 2ª sede (no la 1ª).
    El sync simétrico debe propagarlo igual a la 1ª."""
    client_factory(id="DD-90001", name="Getxo")
    client_factory(id="DD-90002", name="Bilbao")
    # El evento cae en Bilbao (2º miembro), Getxo vacío
    _appt(db_session, "evt_bilbao", "DD-90002")

    groups = [SyncGroup("Maxal", (("DD-90001", "GETXO"), ("DD-90002", "BILBAO")))]
    sync_clinic_groups(db_session, groups)
    db_session.flush()

    # Getxo (1º miembro) DEBE recibir el evento de Bilbao
    dup = db_session.get(Appointment, "evt_bilbao_DD-90001")
    assert dup is not None
    assert dup.matched_client_id == "DD-90001"


def test_idempotente(db_session, client_factory):
    client_factory(id="DD-90001", name="A")
    client_factory(id="DD-90002", name="B")
    _appt(db_session, "e1", "DD-90001")
    groups = [SyncGroup("G", (("DD-90001", "A"), ("DD-90002", "B")))]

    sync_clinic_groups(db_session, groups)
    db_session.flush()
    stats2 = sync_clinic_groups(db_session, groups)
    db_session.flush()

    assert db_session.query(Appointment).filter(Appointment.id == "e1_DD-90002").count() == 1
    assert stats2.get("B", 0) == 0


def test_multi_sede_replica_a_todas(db_session, client_factory):
    for cid in ("DD-90001", "DD-90002", "DD-90003"):
        client_factory(id=cid, name=cid)
    _appt(db_session, "e1", "DD-90001")

    groups = [SyncGroup("G", (("DD-90001", "A"), ("DD-90002", "B"), ("DD-90003", "C")))]
    sync_clinic_groups(db_session, groups)
    db_session.flush()

    assert db_session.get(Appointment, "e1_DD-90002") is not None
    assert db_session.get(Appointment, "e1_DD-90003") is not None


def test_excluye_duplicados_como_fuente(db_session, client_factory):
    client_factory(id="DD-90001", name="A")
    client_factory(id="DD-90002", name="B")
    _appt(db_session, "e1", "DD-90001")
    _appt(db_session, "otro_DD-90001", "DD-90001")  # un duplicado preexistente

    groups = [SyncGroup("G", (("DD-90001", "A"), ("DD-90002", "B")))]
    sync_clinic_groups(db_session, groups)
    db_session.flush()

    assert db_session.get(Appointment, "e1_DD-90002") is not None
    # el duplicado NO se re-sincroniza
    assert db_session.get(Appointment, "otro_DD-90001_DD-90002") is None


def test_build_groups_from_db_y_sync(db_session, client_factory):
    """Los grupos se arman desde la DB (group_id) y el sync simétrico funciona."""
    g = ClinicGroup(name="Maxal")
    db_session.add(g)
    db_session.flush()
    a = client_factory(id="DD-90001", name="Maxal Getxo")
    b = client_factory(id="DD-90002", name="Maxal Bilbao")
    a.group_id = g.id
    b.group_id = g.id
    db_session.flush()
    _appt(db_session, "evt_maxal", "DD-90002")  # cae en Bilbao

    groups = build_groups_from_db(db_session)
    sync_clinic_groups(db_session, groups)
    db_session.flush()

    assert db_session.get(Appointment, "evt_maxal_DD-90001") is not None
