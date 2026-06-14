"""
Sincronización de clínicas que comparten reuniones.

Reemplaza los ~10 bloques copy-paste del ETL por un único loop guiado por
configuración (`domain/sync/groups.py`). Para cada (fuente → destino) duplica
los appointments con id compuesto `{id_fuente}_{id_destino}`, creando o
actualizando según corresponda. Bidireccional para grupos como Triana.

Precarga todos los appointments en memoria => sin N+1 dentro del sync.
NO hace commit (lo maneja el caller). Devuelve {label: nuevos_creados}.
"""
from sqlalchemy.orm import Session

from ..domain.sync.groups import SyncGroup
from ..models import Appointment


def _is_original(appointment_id: str) -> bool:
    """True si NO es un duplicado ya sincronizado (no contiene '_DD-')."""
    return "_DD-" not in appointment_id


def _copy_fields(target, source, target_client_id: str, label: str) -> None:
    target.matched_client_id = target_client_id
    target.analyst_email = source.analyst_email
    target.summary = source.summary
    target.description = source.description
    target.start_time = source.start_time
    target.end_time = source.end_time
    target.attendees = source.attendees
    target.is_client_meeting = source.is_client_meeting
    target.match_status = source.match_status
    target.match_confidence = source.match_confidence
    target.match_reason = f"[{label}] {source.match_reason}"
    target.category = source.category


def _new_duplicate(source, dup_id: str, target_client_id: str, label: str) -> Appointment:
    appt = Appointment(id=dup_id)
    _copy_fields(appt, source, target_client_id, label)
    return appt


def _sync_pair(db, by_id, by_client, source_id, target_id, label) -> int:
    """Sincroniza source_id → target_id. Devuelve cuántos appointments nuevos creó."""
    created = 0
    sources = [a for a in by_client.get(source_id, []) if _is_original(a.id)]
    for src in sources:
        dup_id = f"{src.id}_{target_id}"
        existing = by_id.get(dup_id)
        if existing is not None:
            _copy_fields(existing, src, target_id, label)
        else:
            dup = _new_duplicate(src, dup_id, target_id, label)
            db.add(dup)
            by_id[dup_id] = dup
            by_client.setdefault(target_id, []).append(dup)
            created += 1
    return created


def sync_clinic_groups(db: Session, groups) -> dict:
    """Aplica todos los grupos de sincronización. Devuelve {label: nuevos}."""
    appointments = db.query(Appointment).all()
    by_id = {a.id: a for a in appointments}
    by_client: dict = {}
    for a in appointments:
        by_client.setdefault(a.matched_client_id, []).append(a)

    stats: dict = {}
    for group in groups:
        for target in group.targets:
            stats[target.label] = _sync_pair(
                db, by_id, by_client, group.source_id, target.client_id, target.label
            )
        if group.bidirectional and group.source_label:
            for target in group.targets:
                stats[group.source_label] = _sync_pair(
                    db, by_id, by_client,
                    target.client_id, group.source_id, group.source_label,
                )
    return stats
