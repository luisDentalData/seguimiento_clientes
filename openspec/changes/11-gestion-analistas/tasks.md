# Tasks — Change 11: Gestión de analistas

## Fase 1: Modelo + migración
- [x] 1.1 Modelo Analyst (email PK, name, is_active)
- [x] 1.2 Migración b7c8d9e0f1a2: crear tabla + seed (Úrsula, Marta activas; Carolina inactiva)

## Fase 2: Backend
- [x] 2.1 `src/services/analyst_admin.py` (list, create, update, deactivate, active_analyst_emails)
- [x] 2.2 Endpoints GET/POST/PUT/deactivate + schemas
- [x] 2.3 ETL lee active_analyst_emails(db) con fallback a ANALYST_EMAILS
- [x] 2.4 category_stats.by_analyst → solo activas; /stats/summary analyst_stats → solo activas

## Fase 3: Frontend
- [x] 3.1 `lib/useAnalysts.ts` (lista activa + mapa nombre por email, incl. inactivas; useCallback)
- [x] 3.2 Página `/configuracion` + entrada en Sidebar
- [x] 3.3 Tabla de analistas + alta/renombrar/activar-desactivar
- [x] 3.4 Reemplazar hardcodeos: FilterBar, clientes, analiticas, inicio, reuniones

## Fase 4: Tests + verificación
- [x] 4.1 Tests backend (8): CRUD, active_analyst_emails, by_analyst solo activas, total cuenta todo
- [x] 4.2 Suite completa: 89 verde (fix test_category_stats: sembrar analistas activas)
- [x] 4.3 tsc + eslint . EXIT 0 (sin warnings)
- [x] 4.4 Migración aplicada a DB local: Carolina inactiva, Úrsula+Marta activas
- [x] 4.5 Commit

## Resultado
Analistas como entidad de DB. 6 hardcodeos eliminados (useAnalysts). Página Configuración
con alta/baja. ETL lee de DB (fallback env var). Carolina ya desactivada. 89 tests verde.
PENDIENTE: rebuild de contenedores para ver Change 11 en vivo (backend+frontend cambiaron).
