"""
Estadísticas de carga de reuniones por categoría (taxonomía rica).

Devuelve 3 cortes:
- total:      conteo por categoría (filtra analista + mes)
- by_analyst: por analista, su reparto de categorías (filtra analista + mes)
- by_month:   evolución mensual por categoría (filtra analista, IGNORA el mes
              — si no, no habría serie temporal)

Las reuniones sin categoría (NULL, datos previos al re-ETL) se reportan como
'SIN_CLASIFICAR'. Se agrupa por la columna cruda y se mapea None en Python
(agrupar por COALESCE(...) no es válido en el GROUP BY de Postgres).
"""
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import Appointment as A

_UNCLASSIFIED = "SIN_CLASIFICAR"


def _cat(value: Optional[str]) -> str:
    return value or _UNCLASSIFIED


def _month_expr():
    return func.to_char(A.start_time, "YYYY-MM")


def get_category_stats(
    db: Session,
    analyst_email: Optional[str] = None,
    month: Optional[str] = None,
) -> dict:
    # --- total: filtra analista + mes ---
    total_q = db.query(A.category, func.count(A.id))
    if analyst_email:
        total_q = total_q.filter(A.analyst_email == analyst_email)
    if month:
        total_q = total_q.filter(_month_expr() == month)
    total_agg: dict = {}
    for category, count in total_q.group_by(A.category).all():
        total_agg[_cat(category)] = total_agg.get(_cat(category), 0) + count
    total = [{"category": c, "count": n} for c, n in total_agg.items()]

    # --- by_analyst: filtra analista + mes ---
    analyst_q = db.query(A.analyst_email, A.category, func.count(A.id))
    if analyst_email:
        analyst_q = analyst_q.filter(A.analyst_email == analyst_email)
    if month:
        analyst_q = analyst_q.filter(_month_expr() == month)
    by_analyst: dict = {}
    for analyst, category, count in analyst_q.group_by(
        A.analyst_email, A.category
    ).all():
        bucket = by_analyst.setdefault(analyst, {})
        bucket[_cat(category)] = bucket.get(_cat(category), 0) + count

    # --- by_month: filtra SOLO analista (ignora el mes) ---
    # Agrupamos por mes en Python para evitar problemas del GROUP BY con to_char.
    month_q = db.query(A.start_time, A.category).filter(A.start_time.isnot(None))
    if analyst_email:
        month_q = month_q.filter(A.analyst_email == analyst_email)
    by_month: dict = {}
    for start, category in month_q.all():
        m = start.strftime("%Y-%m")
        bucket = by_month.setdefault(m, {})
        bucket[_cat(category)] = bucket.get(_cat(category), 0) + 1

    return {
        "total": total,
        "by_analyst": [
            {"analyst": a, "categories": cats} for a, cats in by_analyst.items()
        ],
        "by_month": [
            {"month": m, "categories": cats} for m, cats in sorted(by_month.items())
        ],
    }
