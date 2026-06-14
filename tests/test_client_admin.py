"""
Tests de administración de clientes (src/services/client_admin.py).
Contra Postgres real. Cubren: autogeneración de ID, alta, validación,
email duplicado, edición, sync de emails, soft-delete.
"""
import pytest

from src.models import Appointment, Client, ClientEmail
from src.services import client_admin


def test_next_client_id_vacio_es_00001(db_session):
    assert client_admin.next_client_id(db_session) == "DD-00001"


def test_next_client_id_incrementa_el_maximo(db_session, client_factory):
    client_factory(id="DD-00153", name="Cliente 153")
    client_factory(id="DD-00040", name="Cliente 40")
    assert client_admin.next_client_id(db_session) == "DD-00154"


def test_create_client_autogenera_id_y_normaliza(db_session):
    client = client_admin.create_client(db_session, {"name": "Clínica Peña", "emails": ["a@x.com"]})
    db_session.flush()
    assert client.id == "DD-00001"
    assert client.nombre_normalizado == "clinica pena"
    assert client.is_active is True
    emails = [e.email for e in db_session.query(ClientEmail).filter_by(client_id=client.id)]
    assert emails == ["a@x.com"]


def test_create_client_sin_nombre_falla(db_session):
    with pytest.raises(client_admin.ClientAdminError):
        client_admin.create_client(db_session, {"name": "  "})


def test_create_client_email_de_otro_cliente_falla(db_session, client_factory):
    client_factory(id="DD-00001", name="Existente", emails=["shared@x.com"])
    with pytest.raises(client_admin.DuplicateEmailError):
        client_admin.create_client(db_session, {"name": "Nuevo", "emails": ["shared@x.com"]})


def test_update_client_cambia_datos_y_emails(db_session, client_factory):
    client_factory(id="DD-00001", name="Viejo", emails=["a@x.com", "b@x.com"])
    client_admin.update_client(
        db_session, "DD-00001", {"name": "Nuevo Nombre", "emails": ["a@x.com"]}
    )
    db_session.flush()
    client = db_session.get(Client, "DD-00001")
    assert client.name == "Nuevo Nombre"
    assert client.nombre_normalizado == "nuevo nombre"
    emails = {e.email for e in db_session.query(ClientEmail).filter_by(client_id="DD-00001")}
    assert emails == {"a@x.com"}  # b@x.com eliminado


def test_update_client_inexistente_falla(db_session):
    with pytest.raises(client_admin.ClientNotFoundError):
        client_admin.update_client(db_session, "DD-99999", {"name": "x"})


def test_deactivate_client_soft_preserva_appointments(db_session, client_factory):
    client_factory(id="DD-00001", name="A desactivar")
    db_session.add(
        Appointment(
            id="evt1",
            matched_client_id="DD-00001",
            match_status="CONFIRMED",
            is_client_meeting=True,
            summary="reunion",
        )
    )
    db_session.flush()

    client_admin.deactivate_client(db_session, "DD-00001")
    db_session.flush()

    client = db_session.get(Client, "DD-00001")
    assert client.is_active is False
    assert client.status == "INACTIVE"
    # el appointment NO se borra
    assert db_session.get(Appointment, "evt1") is not None


def test_deactivate_inexistente_falla(db_session):
    with pytest.raises(client_admin.ClientNotFoundError):
        client_admin.deactivate_client(db_session, "DD-99999")
