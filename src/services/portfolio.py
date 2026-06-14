"""
Servicio de portfolio de clientes — calcula el estado de seguimiento en el BACKEND.

Esta lógica vivía en el navegador (cada analista veía un estado distinto según
su reloj/timezone). Ahora es UNA sola verdad calculada en el servidor:
- el último/conteo de sesiones válidas se obtiene con SQL agregado (sin N+1)
- el estado OK/ATTENTION/CRITICAL lo decide el dominio (classify_client_status)

Una "sesión válida" = is_client_meeting=True Y match_status IN (CONFIRMED, PROBABLE).

`reference_date` se inyecta (default: ahora del servidor) para que los tests
de "días sin sesión" sean deterministas.
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..domain.clients.status import ClientStatus, classify_client_status
from ..models import Appointment as AppointmentModel, Client as ClientModel

_VALID_STATUSES = ["CONFIRMED", "PROBABLE"]
_STATUS_PRIORITY = {
    ClientStatus.CRITICAL: 0,
    ClientStatus.ATTENTION: 1,
    ClientStatus.OK: 2,
}


@dataclass
class PortfolioEntry:
    id: str
    name: Optional[str]
    nombre_contacto: Optional[str]
    programa: Optional[str]
    provincia: Optional[str]
    last_session: Optional[datetime]
    days_since: Optional[int]
    valid_sessions: int
    last_analyst: Optional[str]
    status: ClientStatus


def _valid_session_filters(analyst_email: Optional[str]):
    filters = [
        AppointmentModel.match_status.in_(_VALID_STATUSES),
        AppointmentModel.is_client_meeting.is_(True),
        AppointmentModel.matched_client_id.isnot(None),
    ]
    if analyst_email:
        filters.append(AppointmentModel.analyst_email == analyst_email)
    return filters


def get_client_portfolio(
    db: Session,
    analyst_email: Optional[str] = None,
    active_only: bool = True,
    reference_date: Optional[datetime] = None,
) -> list[PortfolioEntry]:
    """Devuelve el portfolio de clientes con su estado de seguimiento."""
    if reference_date is None:
        reference_date = datetime.utcnow()

    filters = _valid_session_filters(analyst_email)

    # Agregado por cliente: conteo de sesiones válidas + fecha de la última.
    agg_rows = (
        db.query(
            AppointmentModel.matched_client_id.label("cid"),
            func.count(AppointmentModel.id).label("cnt"),
            func.max(AppointmentModel.start_time).label("last"),
        )
        .filter(*filters)
        .group_by(AppointmentModel.matched_client_id)
        .all()
    )
    agg = {r.cid: (r.cnt, r.last) for r in agg_rows}

    # Analista de la ÚLTIMA sesión válida por cliente (DISTINCT ON en Postgres).
    last_analyst_rows = (
        db.query(
            AppointmentModel.matched_client_id,
            AppointmentModel.analyst_email,
        )
        .filter(*filters)
        .order_by(
            AppointmentModel.matched_client_id,
            AppointmentModel.start_time.desc(),
        )
        .distinct(AppointmentModel.matched_client_id)
        .all()
    )
    last_analyst = {cid: analyst for cid, analyst in last_analyst_rows}

    clients_query = db.query(ClientModel)
    if active_only:
        clients_query = clients_query.filter(ClientModel.is_active.is_(True))
    clients = clients_query.all()

    entries: list[PortfolioEntry] = []
    for client in clients:
        count, last = agg.get(client.id, (0, None))
        days_since = (reference_date - last).days if last is not None else None
        status = classify_client_status(days_since)
        entries.append(
            PortfolioEntry(
                id=client.id,
                name=client.name,
                nombre_contacto=client.nombre_contacto,
                programa=client.programa,
                provincia=client.provincia,
                last_session=last,
                days_since=days_since,
                valid_sessions=count,
                last_analyst=last_analyst.get(client.id),
                status=status,
            )
        )

    # Prioridad: CRITICAL → ATTENTION → OK; dentro de cada grupo, más días primero.
    entries.sort(
        key=lambda e: (
            _STATUS_PRIORITY[e.status],
            -(e.days_since if e.days_since is not None else 10**9),
        )
    )
    return entries
