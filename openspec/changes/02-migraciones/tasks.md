# Tasks — Change 02: Migraciones

## Fase 1: Alembic
- [x] 1.1 Agregar `alembic` a requirements.txt
- [x] 1.2 `alembic init alembic` + configurar `env.py` (Base.metadata, URL desde config/env)
- [x] 1.3 Generar migración baseline (autogenerate contra DB vacía) → 03d2c807e4fc
- [x] 1.4 Verificar `upgrade head` sobre base limpia crea las 3 tablas

## Fase 2: Sync no-destructivo (UPSERT)
- [x] 2.1 `src/scripts/sync_clientes_maestro.py` con core testeable `sync_clientes(db, data)`
- [x] 2.2 Upsert de clientes (ON CONFLICT DO UPDATE), sin tocar appointments
- [x] 2.3 Sync de emails: alta, reasignación, eliminación de huérfanos
- [x] 2.4 CLI wrapper (lee JSON + sesión) con transacción + rollback ante error

## Fase 3: Guard anti-destructivo
- [x] 3.1 `_assert_destructive_allowed()` en load_clientes_maestro.py (flag ALLOW_DESTRUCTIVE_LOAD)
- [x] 3.2 Llamarlo ANTES de drop_all

## Fase 4: Tests (Postgres real)
- [x] 4.1 Update preserva appointments
- [x] 4.2 Alta de cliente nuevo
- [x] 4.3 Idempotencia (sin emails duplicados)
- [x] 4.4 Email huérfano eliminado
- [x] 4.5 Email reasignado entre clientes
- [x] 4.6 Guard bloquea sin flag / permite con flag / valor inválido
- [x] 4.7 Migración baseline crea esquema en DB limpia

## Fase 5: Verificación
- [x] 5.1 Suite completa verde (26 tests)
- [x] 5.2 Commit

## Resultado
26 tests verdes. Alembic con baseline 03d2c807e4fc. Sync no-destructivo (upsert)
preserva appointments. Guard bloquea drop_all sin flag explícito.
