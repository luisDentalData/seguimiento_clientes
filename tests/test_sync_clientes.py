"""
Tests del sync NO destructivo (src/scripts/sync_clientes_maestro.py).

Verifican: update preserva appointments, alta de nuevos, idempotencia,
eliminación de huérfanos y reasignación de emails. Contra Postgres real.
"""
from src.models import Appointment, Client, ClientEmail
from src.scripts.sync_clientes_maestro import sync_clientes


def test_sync_actualiza_cliente_y_preserva_appointments(db_session, client_factory):
    client_factory(
        id="CLI_S1",
        name="Viejo Nombre",
        nombre_normalizado="viejo nombre",
        emails=["a@x.com"],
    )
    db_session.add(
        Appointment(
            id="evt1",
            summary="Reunion con cliente",
            matched_client_id="CLI_S1",
            match_status="CONFIRMED",
            is_client_meeting=True,
        )
    )
    db_session.flush()

    data = [
        {
            "id": "CLI_S1",
            "name": "Nuevo Nombre",
            "nombre_normalizado": "nuevo nombre",
            "emails": ["a@x.com"],
            "status": "ACTIVE",
        }
    ]
    stats = sync_clientes(db_session, data)
    db_session.flush()
    db_session.expire_all()  # leer estado REAL de la DB, no el identity-map viejo

    client = db_session.get(Client, "CLI_S1")
    assert client.name == "Nuevo Nombre"

    appt = db_session.get(Appointment, "evt1")
    assert appt is not None, "el appointment NO debe perderse en un sync"
    assert appt.matched_client_id == "CLI_S1"
    assert stats["clients_upserted"] == 1


def test_sync_da_de_alta_cliente_nuevo(db_session):
    data = [{"id": "CLI_NEW", "name": "Clinica Nueva", "emails": []}]
    sync_clientes(db_session, data)
    db_session.flush()

    assert db_session.get(Client, "CLI_NEW") is not None


def test_sync_es_idempotente_sin_emails_duplicados(db_session):
    data = [{"id": "CLI_S2", "name": "Clinica Dos", "emails": ["dup@x.com"]}]

    sync_clientes(db_session, data)
    db_session.flush()
    sync_clientes(db_session, data)
    db_session.flush()

    count = (
        db_session.query(ClientEmail)
        .filter(ClientEmail.client_id == "CLI_S2")
        .count()
    )
    assert count == 1


def test_sync_elimina_email_huerfano(db_session, client_factory):
    client_factory(id="CLI_S3", name="Clinica Tres", emails=["a@x.com", "b@x.com"])

    data = [{"id": "CLI_S3", "name": "Clinica Tres", "emails": ["a@x.com"]}]
    stats = sync_clientes(db_session, data)
    db_session.flush()

    emails = {
        e.email
        for e in db_session.query(ClientEmail).filter(
            ClientEmail.client_id == "CLI_S3"
        )
    }
    assert emails == {"a@x.com"}
    assert stats["emails_removed"] == 1


def test_sync_reasigna_email_entre_clientes(db_session, client_factory):
    client_factory(id="CLI_A", name="Clinica A", emails=["shared@x.com"])
    client_factory(id="CLI_B", name="Clinica B", emails=[])

    data = [{"id": "CLI_B", "name": "Clinica B", "emails": ["shared@x.com"]}]
    stats = sync_clientes(db_session, data)
    db_session.flush()

    ce = db_session.query(ClientEmail).filter(ClientEmail.email == "shared@x.com").one()
    assert ce.client_id == "CLI_B"
    assert stats["emails_reassigned"] == 1
