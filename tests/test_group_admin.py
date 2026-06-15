"""
Tests de administración de grupos de sedes. Postgres real.
Cubren: CRUD, regenerar/limpieza al quitar sede, originales intactos, borrar grupo.
"""
import pytest

from src.models import Appointment, Client, ClinicGroup
from src.services import group_admin


def _appt(db, appt_id, client_id):
    db.add(Appointment(id=appt_id, matched_client_id=client_id, match_status="CONFIRMED",
                       is_client_meeting=True, summary="reunion", match_reason="m",
                       match_confidence=1.0, category="CLIENTE", analyst_email="a@dentaldata.es"))
    db.flush()


def test_create_y_list(db_session):
    g = group_admin.create_group(db_session, "Maxal")
    db_session.flush()
    grupos = group_admin.list_groups(db_session)
    assert any(x["name"] == "Maxal" and x["id"] == g.id for x in grupos)


def test_create_duplicado_falla(db_session):
    group_admin.create_group(db_session, "Maxal")
    with pytest.raises(group_admin.DuplicateGroupError):
        group_admin.create_group(db_session, "Maxal")


def test_rename(db_session):
    g = group_admin.create_group(db_session, "Viejo")
    group_admin.rename_group(db_session, g.id, "Nuevo")
    db_session.flush()
    assert db_session.get(ClinicGroup, g.id).name == "Nuevo"


def test_assign_sincroniza_simetrico(db_session, client_factory):
    g = group_admin.create_group(db_session, "Maxal")
    client_factory(id="DD-90001", name="Getxo")
    client_factory(id="DD-90002", name="Bilbao")
    _appt(db_session, "evt", "DD-90002")  # reunión en Bilbao

    group_admin.assign_client(db_session, g.id, "DD-90001")
    group_admin.assign_client(db_session, g.id, "DD-90002")
    db_session.flush()

    # Getxo recibe la reunión de Bilbao (simétrico)
    assert db_session.get(Appointment, "evt_DD-90001") is not None


def test_remove_limpia_dups_pero_conserva_originales(db_session, client_factory):
    g = group_admin.create_group(db_session, "Maxal")
    client_factory(id="DD-90001", name="Getxo")
    client_factory(id="DD-90002", name="Bilbao")
    _appt(db_session, "evt_getxo", "DD-90001")  # ORIGINAL de Getxo
    group_admin.assign_client(db_session, g.id, "DD-90001")
    group_admin.assign_client(db_session, g.id, "DD-90002")
    db_session.flush()
    # Bilbao tiene la copia
    assert db_session.get(Appointment, "evt_getxo_DD-90002") is not None

    # Saco Bilbao del grupo
    group_admin.remove_client(db_session, "DD-90002")
    db_session.flush()

    # La copia en Bilbao se borró...
    assert db_session.get(Appointment, "evt_getxo_DD-90002") is None
    # ...pero el ORIGINAL de Getxo sigue intacto
    assert db_session.get(Appointment, "evt_getxo") is not None


def test_delete_group_desasigna_sedes(db_session, client_factory):
    g = group_admin.create_group(db_session, "Maxal")
    client_factory(id="DD-90001", name="Getxo")
    a = db_session.get(Client, "DD-90001")
    a.group_id = g.id
    db_session.flush()

    group_admin.delete_group(db_session, g.id)
    db_session.flush()

    assert db_session.get(ClinicGroup, g.id) is None
    assert db_session.get(Client, "DD-90001").group_id is None  # cliente NO se borra
