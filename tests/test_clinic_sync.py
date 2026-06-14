"""
Tests de la sincronización de clínicas (src/services/clinic_sync.py).

El sync NUNCA tuvo tests; estos fijan su comportamiento (forward, idempotencia,
update, multi-target, bidireccional, exclusión de duplicados) ANTES de confiar
en el refactor que colapsó los ~10 bloques copy-paste. Contra Postgres real.

Se usan IDs de cliente con prefijo DD- (como en producción) para que la
exclusión de duplicados (`'_DD-' in id`) funcione igual que en el sistema real.
"""
from src.domain.sync.groups import SYNC_GROUPS, SyncGroup, SyncTarget
from src.models import Appointment
from src.services.clinic_sync import sync_clinic_groups


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


def test_forward_sync_crea_duplicado(db_session, client_factory):
    client_factory(id="DD-90001", name="Fuente")
    client_factory(id="DD-90002", name="Destino")
    _appt(db_session, "e1", "DD-90001")

    groups = [SyncGroup("DD-90001", (SyncTarget("DD-90002", "DESTINO"),))]
    stats = sync_clinic_groups(db_session, groups)
    db_session.flush()

    dup = db_session.get(Appointment, "e1_DD-90002")
    assert dup is not None
    assert dup.matched_client_id == "DD-90002"
    assert dup.match_reason.startswith("[DESTINO]")
    assert dup.category == "CLIENTE"
    assert stats["DESTINO"] == 1


def test_sync_es_idempotente(db_session, client_factory):
    client_factory(id="DD-90001", name="Fuente")
    client_factory(id="DD-90002", name="Destino")
    _appt(db_session, "e1", "DD-90001")
    groups = [SyncGroup("DD-90001", (SyncTarget("DD-90002", "DESTINO"),))]

    sync_clinic_groups(db_session, groups)
    db_session.flush()
    stats2 = sync_clinic_groups(db_session, groups)
    db_session.flush()

    count = db_session.query(Appointment).filter(Appointment.id == "e1_DD-90002").count()
    assert count == 1
    assert stats2["DESTINO"] == 0  # no crea de nuevo


def test_sync_actualiza_duplicado_existente(db_session, client_factory):
    client_factory(id="DD-90001", name="Fuente")
    client_factory(id="DD-90002", name="Destino")
    src = _appt(db_session, "e1", "DD-90001", summary="titulo viejo")
    groups = [SyncGroup("DD-90001", (SyncTarget("DD-90002", "DESTINO"),))]
    sync_clinic_groups(db_session, groups)
    db_session.flush()

    src.summary = "titulo nuevo"
    db_session.flush()
    sync_clinic_groups(db_session, groups)
    db_session.flush()

    dup = db_session.get(Appointment, "e1_DD-90002")
    assert dup.summary == "titulo nuevo"


def test_multi_target_crea_uno_por_destino(db_session, client_factory):
    for cid in ("DD-90001", "DD-90002", "DD-90003", "DD-90004"):
        client_factory(id=cid, name=cid)
    _appt(db_session, "e1", "DD-90001")

    groups = [
        SyncGroup(
            "DD-90001",
            (
                SyncTarget("DD-90002", "T2"),
                SyncTarget("DD-90003", "T3"),
                SyncTarget("DD-90004", "T4"),
            ),
        )
    ]
    stats = sync_clinic_groups(db_session, groups)
    db_session.flush()

    for cid, label in [("DD-90002", "T2"), ("DD-90003", "T3"), ("DD-90004", "T4")]:
        assert db_session.get(Appointment, f"e1_{cid}") is not None
        assert stats[label] == 1


def test_bidireccional_sincroniza_ambos_sentidos(db_session, client_factory):
    client_factory(id="DD-90001", name="Triana 2")
    client_factory(id="DD-90002", name="Triana 1")
    _appt(db_session, "s1", "DD-90001")
    _appt(db_session, "t1", "DD-90002")

    groups = [
        SyncGroup(
            "DD-90001",
            (SyncTarget("DD-90002", "TRIANA 1"),),
            bidirectional=True,
            source_label="TRIANA 2",
        )
    ]
    sync_clinic_groups(db_session, groups)
    db_session.flush()

    # forward: s1 -> DD-90002 ; reverse: t1 -> DD-90001
    assert db_session.get(Appointment, "s1_DD-90002") is not None
    assert db_session.get(Appointment, "t1_DD-90001") is not None
    # NO debe re-sincronizar el duplicado forward de vuelta a la fuente
    assert db_session.get(Appointment, "s1_DD-90002_DD-90001") is None


def test_excluye_duplicados_como_fuente(db_session, client_factory):
    client_factory(id="DD-90001", name="Fuente")
    client_factory(id="DD-90002", name="Destino")
    _appt(db_session, "e1", "DD-90001")  # original
    # un duplicado preexistente apuntando a la fuente (no debe usarse como fuente)
    _appt(db_session, "otro_DD-90001", "DD-90001")

    groups = [SyncGroup("DD-90001", (SyncTarget("DD-90002", "DESTINO"),))]
    sync_clinic_groups(db_session, groups)
    db_session.flush()

    assert db_session.get(Appointment, "e1_DD-90002") is not None
    # el duplicado NO se vuelve a sincronizar
    assert db_session.get(Appointment, "otro_DD-90001_DD-90002") is None


def test_config_real_elite_crea_seis_duplicados(db_session, client_factory):
    """Smoke test contra la config REAL: Elite source → 6 destinos."""
    elite_ids = ["DD-00070", "DD-00071", "DD-00072", "DD-00073",
                 "DD-00074", "DD-00075", "DD-00076"]
    for cid in elite_ids:
        client_factory(id=cid, name=cid)
    _appt(db_session, "evt_elite", "DD-00070")

    stats = sync_clinic_groups(db_session, SYNC_GROUPS)
    db_session.flush()

    created_for_elite = sum(
        1 for tid in elite_ids[1:]
        if db_session.get(Appointment, f"evt_elite_{tid}") is not None
    )
    assert created_for_elite == 6
