"""
Administración de analistas (entidad de DB).

Reemplaza el env var ANALYST_EMAILS + los hardcodeos del frontend. El ETL usa
`active_analyst_emails` para saber qué calendarios bajar; el frontend lee la
lista desde los endpoints.

Desactivar es soft (is_active=False): no borra ni toca las reuniones históricas.
"""
from typing import Optional

from sqlalchemy.orm import Session

from ..models import Analyst


class AnalystAdminError(Exception):
    """Error de validación (→ HTTP 400)."""


class DuplicateAnalystError(AnalystAdminError):
    """El email ya existe (→ HTTP 409)."""


class AnalystNotFoundError(AnalystAdminError):
    """La analista no existe (→ HTTP 404)."""


def list_analysts(db: Session, active_only: bool = False) -> list:
    query = db.query(Analyst)
    if active_only:
        query = query.filter(Analyst.is_active.is_(True))
    return query.order_by(Analyst.name).all()


def active_analyst_emails(db: Session) -> list:
    """Emails de analistas activas — fuente del ETL."""
    return [
        a.email
        for a in db.query(Analyst).filter(Analyst.is_active.is_(True)).all()
    ]


def create_analyst(db: Session, email: str, name: str) -> Analyst:
    email = (email or "").strip().lower()
    name = (name or "").strip()
    if not email or "@" not in email:
        raise AnalystAdminError("Email inválido")
    if not name:
        raise AnalystAdminError("El nombre es obligatorio")
    if db.get(Analyst, email) is not None:
        raise DuplicateAnalystError(f"La analista {email} ya existe")

    analyst = Analyst(email=email, name=name, is_active=True)
    db.add(analyst)
    db.flush()
    return analyst


def update_analyst(
    db: Session,
    email: str,
    name: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> Analyst:
    analyst = db.get(Analyst, email)
    if analyst is None:
        raise AnalystNotFoundError(f"La analista {email} no existe")
    if name is not None:
        if not name.strip():
            raise AnalystAdminError("El nombre no puede quedar vacío")
        analyst.name = name.strip()
    if is_active is not None:
        analyst.is_active = is_active
    db.flush()
    return analyst


def deactivate_analyst(db: Session, email: str) -> Analyst:
    return update_analyst(db, email, is_active=False)
