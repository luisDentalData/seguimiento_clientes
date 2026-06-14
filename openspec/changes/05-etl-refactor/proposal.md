# Change 05 — ETL refactor (sync config-driven + N+1 + categoría persistida)

## Intent
1. Colapsar los ~10 bloques copy-paste de sincronización de clínicas en una tabla de configuración + un único loop.
2. Eliminar los N+1 reales del ETL.
3. Persistir la taxonomía rica (categoría) en la tabla `appointments`.

## Why
Prioridad #3 (Performance) + #4 (Mantenibilidad). El ETL tenía 773 líneas con ~600 de copy-paste; agregar una clínica era copiar 50 líneas. Los N+1 hacían miles de roundtrips por corrida. Y la taxonomía rica del dominio (Change 3) no se estaba guardando.

## Scope
- IN: `domain/sync/groups.py` (config) + `services/clinic_sync.py` (loop genérico); refactor `etl.py`; columna `category` + migración; `Matcher` expone categoría + `client_name()`.
- OUT: dashboard que muestre la categoría (Change 6/analytics). Scheduler automático (escalabilidad, diferido).

## Principios innegociables
- El sync NUNCA tuvo tests → se escriben tests ANTES de confiar en el refactor.
- Behavior-preserving: los 17 tests de caracterización del Matcher siguen verdes.
- La columna es aditiva/nullable: filas viejas en NULL hasta el próximo ETL.

## Affected modules
- Nuevo: `src/domain/sync/groups.py`, `src/services/clinic_sync.py`, migración `a1b2c3d4e5f6`
- Modificado: `src/etl.py` (773→192 líneas), `src/services/matching.py` (category + client_name), `src/models.py` (category)

## Rollback plan
`git revert`. La migración trae downgrade (drop column). El contrato legacy del Matcher no cambió (solo se agregó la key `category`).

## Risks
- Regresión en la lógica de sync (no tenía tests) → mitigado con 7 tests nuevos (forward, idempotencia, update, multi-target, bidireccional, exclusión de duplicados, config real Elite).
- Filas existentes sin categoría hasta re-ETL → aceptado (aditivo).
- DBs existentes necesitan `alembic stamp 03d2c807e4fc && alembic upgrade head` para aplicar la columna.
