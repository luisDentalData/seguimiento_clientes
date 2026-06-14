# Tasks — Change 05: ETL refactor

## Fase 1: Config + sync genérico
- [x] 1.1 `src/domain/sync/groups.py` — SyncGroup/SyncTarget + SYNC_GROUPS (10 grupos)
- [x] 1.2 `src/services/clinic_sync.py` — sync_clinic_groups (loop genérico, precarga en memoria)
- [x] 1.3 Soporte bidireccional + exclusión de duplicados

## Fase 2: Categoría persistida
- [x] 2.1 `category` en modelo Appointment
- [x] 2.2 Migración Alembic a1b2c3d4e5f6 (add column + index)
- [x] 2.3 Matcher expone `category` en el dict legacy
- [x] 2.4 ETL guarda category (nuevos y updates)

## Fase 3: Eliminar N+1
- [x] 3.1 Precargar appointments existentes (mata N+1 por evento)
- [x] 3.2 `Matcher.client_name()` desde cache (mata N+1 de logging)

## Fase 4: Refactor ETL
- [x] 4.1 Reemplazar ~600 líneas de sync por sync_clinic_groups(db, SYNC_GROUPS)
- [x] 4.2 etl.py: 773 → 192 líneas

## Fase 5: Tests (Postgres real)
- [x] 5.1 clinic_sync: forward, idempotencia, update, multi-target, bidireccional, exclusión, config real Elite (7)
- [x] 5.2 Matcher expone category (4)
- [x] 5.3 Migración: assert columna category
- [x] 5.4 17 caracterización siguen verdes (ETL/Matcher cambiaron)
- [x] 5.5 Suite completa: 66 verde
- [x] 5.6 Commit

## Resultado
ETL 773→192 líneas. ~10 bloques copy-paste → 1 tabla config + 1 loop. N+1 eliminados.
Categoría rica persistida (columna + migración). 66 tests verde (11 nuevos).
NOTA deploy: DBs existentes requieren `alembic stamp 03d2c807e4fc && alembic upgrade head`.
