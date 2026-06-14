"""
Administración de clientes desde la UI (crear / editar / desactivar).

La DB es la fuente de verdad. NUNCA borra appointments. El re-matching se
dispara aparte con el botón Sync (ETL). El `nombre_normalizado` se deriva del
nombre con el mismo normalizador del dominio (consistencia con el matcher).

Incluye `set_client_emails`, helper compartido con el sync masivo
(sync_clientes_maestro): por eso acepta `reassign` para distinguir la política
del bulk (reasigna emails de otro cliente) de la de la UI (rechaza duplicados).
"""
from sqlalchemy.orm import Session

from ..domain.meetings.classifier import normalize_text
from ..models import Client, ClientEmail

ID_PREFIX = "DD-"

# Campos de cliente editables desde la UI.
_EDITABLE_FIELDS = (
    "name",
    "nombre_contacto",
    "telefono",
    "movil",
    "direccion",
    "poblacion",
    "provincia",
    "nif_cif",
    "programa",
    "nombres_alternativos",
)


class ClientAdminError(Exception):
    """Error de validación de negocio (→ HTTP 400)."""


class DuplicateEmailError(ClientAdminError):
    """Un email ya pertenece a otro cliente (→ HTTP 409)."""


class ClientNotFoundError(ClientAdminError):
    """El cliente no existe (→ HTTP 404)."""


def next_client_id(db: Session) -> str:
    """Calcula el siguiente ID DD-XXXXX (máximo numérico + 1)."""
    max_n = 0
    for (cid,) in db.query(Client.id).all():
        if cid and cid.startswith(ID_PREFIX):
            suffix = cid[len(ID_PREFIX):]
            if suffix.isdigit():
                max_n = max(max_n, int(suffix))
    return f"{ID_PREFIX}{max_n + 1:05d}"


def set_client_emails(
    db: Session,
    client_id: str,
    emails: list,
    reassign: bool = False,
) -> dict:
    """Sincroniza los emails de un cliente (alta/baja/[reasignación]).

    - reassign=True  (bulk): si un email pertenece a otro cliente, lo reasigna.
    - reassign=False (UI):  si un email pertenece a otro cliente, lanza DuplicateEmailError.
    """
    stats = {"emails_added": 0, "emails_removed": 0, "emails_reassigned": 0}
    desired = {e.lower().strip() for e in (emails or []) if e}

    existing = db.query(ClientEmail).filter(ClientEmail.client_id == client_id).all()
    existing_map = {ce.email: ce for ce in existing}

    # Eliminar huérfanos
    for email, ce in existing_map.items():
        if email not in desired:
            db.delete(ce)
            stats["emails_removed"] += 1

    # Altas / reasignaciones
    for email in desired:
        if email in existing_map:
            continue
        other = db.query(ClientEmail).filter(ClientEmail.email == email).first()
        if other is not None:
            if other.client_id != client_id:
                if not reassign:
                    raise DuplicateEmailError(
                        f"El email '{email}' ya pertenece a otro cliente ({other.client_id})"
                    )
                other.client_id = client_id
                stats["emails_reassigned"] += 1
        else:
            db.add(ClientEmail(client_id=client_id, email=email))
            stats["emails_added"] += 1

    return stats


def create_client(db: Session, data: dict) -> Client:
    """Crea un cliente con ID autogenerado + emails. No hace commit."""
    name = (data.get("name") or "").strip()
    if not name:
        raise ClientAdminError("El nombre es obligatorio")

    client_id = next_client_id(db)
    status_value = (data.get("status") or "ACTIVE").upper()
    client = Client(
        id=client_id,
        name=name,
        nombre_normalizado=(data.get("nombre_normalizado") or normalize_text(name)),
        nombres_alternativos=data.get("nombres_alternativos") or [],
        nombre_contacto=data.get("nombre_contacto"),
        telefono=data.get("telefono"),
        movil=data.get("movil"),
        direccion=data.get("direccion"),
        poblacion=data.get("poblacion"),
        provincia=data.get("provincia"),
        nif_cif=data.get("nif_cif"),
        programa=data.get("programa"),
        fuentes=data.get("fuentes") or [],
        status=status_value,
        is_active=(status_value == "ACTIVE"),
    )
    db.add(client)
    db.flush()

    set_client_emails(db, client_id, data.get("emails") or [], reassign=False)
    db.flush()
    return client


def update_client(db: Session, client_id: str, data: dict) -> Client:
    """Actualiza datos y/o emails de un cliente existente. No hace commit."""
    client = db.get(Client, client_id)
    if client is None:
        raise ClientNotFoundError(f"Cliente {client_id} no existe")

    for field in _EDITABLE_FIELDS:
        if field in data:
            setattr(client, field, data[field])

    # Mantener nombre_normalizado coherente con el nombre.
    if "nombre_normalizado" in data and data["nombre_normalizado"]:
        client.nombre_normalizado = data["nombre_normalizado"]
    elif "name" in data and data["name"]:
        client.nombre_normalizado = normalize_text(data["name"])

    db.flush()

    if "emails" in data:
        set_client_emails(db, client_id, data["emails"], reassign=False)
        db.flush()

    return client


def deactivate_client(db: Session, client_id: str) -> Client:
    """Soft-delete: marca inactivo sin borrar nada (preserva appointments)."""
    client = db.get(Client, client_id)
    if client is None:
        raise ClientNotFoundError(f"Cliente {client_id} no existe")
    client.is_active = False
    client.status = "INACTIVE"
    db.flush()
    return client
