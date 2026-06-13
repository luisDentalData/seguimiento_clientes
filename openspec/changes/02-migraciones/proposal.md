# Change 02 — Migraciones (Alembic + UPSERT + guard anti-drop_all)

## Intent
Eliminar el riesgo #1 de pérdida de datos: el script `load_clientes_maestro.py` hace `Base.metadata.drop_all()` (borra 153 clientes + emails + 5.522 appointments) cada vez que se quiere agregar UN cliente. Lo reemplazamos por:
1. **Alembic** para migraciones de esquema versionadas.
2. **`sync_clientes_maestro.py`** con UPSERT (INSERT ... ON CONFLICT DO UPDATE) que preserva appointments.
3. **Guard anti-destructivo** en el script viejo (solo corre con flag explícito; queda para disaster recovery).

## Why
Prioridad #2: Seguridad de datos. Agregar un cliente NO puede significar destruir toda la base.

## Scope
- IN: setup de Alembic + migración baseline del esquema actual; `sync_clientes_maestro.py` con upsert testeable; guard en `load_clientes_maestro.py`.
- IN: tests de upsert (idempotencia, update, preservación de appointments, orphan emails) y del guard.
- OUT (diferido): Valkey/cache (escalabilidad).

## Principios innegociables
- El upsert NUNCA dropea tablas ni toca `appointments`.
- Lógica de sync extraída a función pura testeable `sync_clientes(db, data)` — NO leer archivo/DB en el core.
- Tests contra Postgres real.

## Affected modules
- Nuevo: `alembic/`, `alembic.ini`, `src/scripts/sync_clientes_maestro.py`
- Modificado: `src/scripts/load_clientes_maestro.py` (guard), `requirements.txt` (alembic)

## Rollback plan
- Alembic trae `downgrade`. El sync es no-destructivo (transacción + rollback ante error).
- Backup de la DB antes de la primera corrida real en prod.
- El script viejo sigue existiendo (con guard) para disaster recovery.

## Risks
- Migración baseline mal generada → mitigación: autogenerar contra DB vacía y verificar `upgrade head` sobre base limpia.
- Reasignación de emails entre clientes → cubierto con test explícito.
