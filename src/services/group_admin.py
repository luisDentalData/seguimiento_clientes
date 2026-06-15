"""
Administración de grupos de sedes (entidad de DB).

Reemplaza la config hardcodeada. Los duplicados de sync son datos DERIVADOS:
ante cualquier cambio de membresía se REGENERAN (se borran los `_DD-` de los
miembros y se vuelve a sincronizar), garantizando coherencia. Los appointments
ORIGINALES nunca se tocan.
"""
from sqlalchemy.orm import Session

from ..models import Appointment, Client, ClinicGroup
from .clinic_sync import sync_clinic_groups
from ..domain.sync.groups import SyncGroup


class GroupAdminError(Exception):
    """Error de validación (→ HTTP 400)."""


class GroupNotFoundError(GroupAdminError):
    """El grupo no existe (→ HTTP 404)."""


class DuplicateGroupError(GroupAdminError):
    """Ya existe un grupo con ese nombre (→ HTTP 409)."""


def _delete_synced_dups_for(db: Session, client_ids: list) -> None:
    """Borra SOLO los duplicados de sync (id con '_DD-') de esos clientes.
    Los originales (sin '_DD-') quedan intactos."""
    if not client_ids:
        return
    dups = (
        db.query(Appointment)
        .filter(Appointment.matched_client_id.in_(client_ids))
        .filter(Appointment.id.like("%\\_DD-%", escape="\\"))
        .all()
    )
    for d in dups:
        db.delete(d)
    db.flush()


def regenerate_group(db: Session, group_id: int) -> None:
    """Regenera los duplicados de un grupo: limpia y re-sincroniza desde cero."""
    members = db.query(Client).filter(Client.group_id == group_id).all()
    member_ids = [c.id for c in members]
    _delete_synced_dups_for(db, member_ids)
    if len(members) >= 2:
        group = SyncGroup(
            name=str(group_id),
            members=tuple((c.id, c.name) for c in members),
        )
        sync_clinic_groups(db, [group])
    db.flush()


def list_groups(db: Session) -> list:
    """Grupos con sus sedes (id, name, members)."""
    result = []
    for g in db.query(ClinicGroup).order_by(ClinicGroup.name).all():
        members = (
            db.query(Client).filter(Client.group_id == g.id).order_by(Client.id).all()
        )
        result.append({
            "id": g.id,
            "name": g.name,
            "members": [{"id": c.id, "name": c.name} for c in members],
        })
    return result


def create_group(db: Session, name: str) -> ClinicGroup:
    name = (name or "").strip()
    if not name:
        raise GroupAdminError("El nombre del grupo es obligatorio")
    if db.query(ClinicGroup).filter(ClinicGroup.name == name).first() is not None:
        raise DuplicateGroupError(f"Ya existe un grupo '{name}'")
    group = ClinicGroup(name=name)
    db.add(group)
    db.flush()
    return group


def rename_group(db: Session, group_id: int, name: str) -> ClinicGroup:
    group = db.get(ClinicGroup, group_id)
    if group is None:
        raise GroupNotFoundError(f"Grupo {group_id} no existe")
    name = (name or "").strip()
    if not name:
        raise GroupAdminError("El nombre no puede quedar vacío")
    existing = db.query(ClinicGroup).filter(ClinicGroup.name == name).first()
    if existing is not None and existing.id != group_id:
        raise DuplicateGroupError(f"Ya existe un grupo '{name}'")
    group.name = name
    db.flush()
    return group


def delete_group(db: Session, group_id: int) -> None:
    group = db.get(ClinicGroup, group_id)
    if group is None:
        raise GroupNotFoundError(f"Grupo {group_id} no existe")
    members = db.query(Client).filter(Client.group_id == group_id).all()
    member_ids = [c.id for c in members]
    # Desasignar sedes (no se borran clientes) y limpiar sus duplicados.
    for c in members:
        c.group_id = None
    db.flush()
    _delete_synced_dups_for(db, member_ids)
    db.delete(group)
    db.flush()


def assign_client(db: Session, group_id: int, client_id: str) -> None:
    group = db.get(ClinicGroup, group_id)
    if group is None:
        raise GroupNotFoundError(f"Grupo {group_id} no existe")
    client = db.get(Client, client_id)
    if client is None:
        raise GroupAdminError(f"Cliente {client_id} no existe")
    old_group = client.group_id
    client.group_id = group_id
    db.flush()
    # Limpiar copias viejas hacia este cliente y regenerar grupos afectados.
    _delete_synced_dups_for(db, [client_id])
    if old_group and old_group != group_id:
        regenerate_group(db, old_group)
    regenerate_group(db, group_id)


def remove_client(db: Session, client_id: str) -> None:
    client = db.get(Client, client_id)
    if client is None:
        raise GroupAdminError(f"Cliente {client_id} no existe")
    old_group = client.group_id
    client.group_id = None
    db.flush()
    _delete_synced_dups_for(db, [client_id])
    if old_group:
        regenerate_group(db, old_group)
