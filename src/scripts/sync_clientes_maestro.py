"""
Sincronización NO destructiva de clientes desde clientes_maestro.json.

Reemplaza a load_clientes_maestro.py (que dropea TODAS las tablas).
Usa UPSERT (INSERT ... ON CONFLICT DO UPDATE) para clientes y un sync
fino de emails (alta / reasignación / eliminación de huérfanos).

NUNCA dropea tablas. NUNCA toca la tabla `appointments`.

La lógica vive en `sync_clientes(db, data)` (función pura testeable);
el wrapper de CLI solo lee el archivo y maneja la sesión/transacción.
"""
import json
import os
import sys

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

# Permite ejecutar como script suelto (python src/scripts/sync_clientes_maestro.py)
sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from src.database import SessionLocal  # noqa: E402
from src.models import Client  # noqa: E402
from src.services.client_admin import set_client_emails  # noqa: E402

# Columnas del cliente que se sincronizan desde el maestro.
CLIENT_COLUMNS = [
    "id",
    "name",
    "nombre_normalizado",
    "nombres_alternativos",
    "nombre_contacto",
    "telefono",
    "movil",
    "direccion",
    "poblacion",
    "provincia",
    "nif_cif",
    "programa",
    "fuentes",
    "status",
    "is_active",
]


def _client_row(data: dict) -> dict:
    """Mapea un registro del maestro a una fila de la tabla clients."""
    status_value = (data.get("status") or "ACTIVE").upper()
    return {
        "id": data.get("id"),
        "name": data.get("name") or data.get("nombre"),  # soporta ambas claves
        "nombre_normalizado": data.get("nombre_normalizado"),
        "nombres_alternativos": data.get("nombres_alternativos", []),
        "nombre_contacto": data.get("nombre_contacto"),
        "telefono": data.get("telefono"),
        "movil": data.get("movil"),
        "direccion": data.get("direccion"),
        "poblacion": data.get("poblacion"),
        "provincia": data.get("provincia"),
        "nif_cif": data.get("nif_cif"),
        "programa": data.get("programa"),
        "fuentes": data.get("fuentes", []),
        "status": status_value,
        "is_active": status_value == "ACTIVE",
    }


def sync_clientes(db: Session, clientes_data: list[dict]) -> dict:
    """
    Sincroniza clientes y emails de forma NO destructiva.

    - Clientes: UPSERT por id (ON CONFLICT DO UPDATE).
    - Emails: alta de nuevos, reasignación si el email pertenecía a otro cliente,
      y eliminación de los que ya no figuran para ese cliente.
    - NO toca `appointments`. NO dropea nada.

    Devuelve un dict con estadísticas. No hace commit (lo maneja el caller).
    """
    stats = {
        "clients_upserted": 0,
        "emails_added": 0,
        "emails_removed": 0,
        "emails_reassigned": 0,
    }

    rows = [_client_row(d) for d in clientes_data if d.get("id")]
    if rows:
        stmt = pg_insert(Client).values(rows)
        update_cols = {
            col: getattr(stmt.excluded, col) for col in CLIENT_COLUMNS if col != "id"
        }
        update_cols["updated_at"] = func.now()
        stmt = stmt.on_conflict_do_update(index_elements=["id"], set_=update_cols)
        db.execute(stmt)
        stats["clients_upserted"] = len(rows)

    for data in clientes_data:
        client_id = data.get("id")
        if not client_id:
            continue

        # Bulk: reassign=True (un email de otro cliente se reasigna, no se rechaza).
        email_stats = set_client_emails(
            db, client_id, data.get("emails") or [], reassign=True
        )
        stats["emails_added"] += email_stats["emails_added"]
        stats["emails_removed"] += email_stats["emails_removed"]
        stats["emails_reassigned"] += email_stats["emails_reassigned"]
        db.flush()

    return stats


def main() -> None:
    root = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )
    maestro_path = os.path.join(root, "clientes_maestro.json")
    print(f"Sincronizando (no destructivo) desde: {maestro_path}")

    with open(maestro_path, "r", encoding="utf-8") as f:
        clientes_data = json.load(f)

    db = SessionLocal()
    try:
        stats = sync_clientes(db, clientes_data)
        db.commit()
        print("[OK] Sync completado (appointments intactos):")
        for k, v in stats.items():
            print(f"   - {k}: {v}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
