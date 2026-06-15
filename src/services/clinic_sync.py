"""
Sincronización SIMÉTRICA de clínicas que comparten reuniones.

Para cada grupo, junta los appointments ORIGINALES de TODOS sus miembros y los
replica al resto. Así, no importa a cuál sede el matcher haya asignado el
evento: todas las sedes del grupo terminan con la unión de las reuniones.

Duplicado: id compuesto `{id_original}_{id_destino}`. Idempotente (crea o
actualiza). NO hace commit (lo maneja el caller). Devuelve {label: nuevos}.
"""
from sqlalchemy.orm import Session

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


def sync_clinic_groups(db: Session, groups) -> dict:
    """Replica simétricamente las reuniones dentro de cada grupo de sedes."""
    appointments = db.query(Appointment).all()
    by_id = {a.id: a for a in appointments}
    by_client: dict = {}
    for a in appointments:
        by_client.setdefault(a.matched_client_id, []).append(a)

    stats: dict = {}
    for group in groups:
        member_ids = [m[0] for m in group.members]
        label_of = {cid: label for cid, label in group.members}

        # Originales matcheados a CUALQUIER miembro del grupo.
        originals = []
        for mid in member_ids:
            originals += [a for a in by_client.get(mid, []) if _is_original(a.id)]

        # Replicar cada original al RESTO de los miembros.
        for src in originals:
            for dest_id in member_ids:
                if dest_id == src.matched_client_id:
                    continue
                dup_id = f"{src.id}_{dest_id}"
                label = label_of[dest_id]
                existing = by_id.get(dup_id)
                if existing is not None:
                    _copy_fields(existing, src, dest_id, label)
                else:
                    dup = _new_duplicate(src, dup_id, dest_id, label)
                    db.add(dup)
                    by_id[dup_id] = dup
                    by_client.setdefault(dest_id, []).append(dup)
                    stats[label] = stats.get(label, 0) + 1

    return stats
