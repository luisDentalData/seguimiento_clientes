# Change 11 — Gestión de analistas como entidad

## Intent
Convertir "analista" en una entidad de la base de datos (tabla `analysts`) gestionable desde la UI (alta/baja/editar), eliminando los 6 hardcodeos actuales (env var + 5 archivos de frontend). El ETL lee las analistas activas de la DB; el frontend lee la lista de un endpoint.

## Why
Hoy agregar o dar de baja una analista requiere editar el env var `ANALYST_EMAILS` + 5 archivos de frontend + 2 rebuilds. Inmanejable. Caso real: Carolina ya no trabaja y hay que dar de alta a otra.

## Decisiones (brainstorming)
- Analista = tabla en DB (email PK, name, is_active).
- Desactivar: conserva histórico; se OCULTA como dimensión (dropdowns + gráfico por analista) pero sus sesiones SIGUEN contando para el estado del cliente y los totales (la sesión existió — no falseamos).
- UI: página nueva "Configuración" en el sidebar.

## Scope
- IN: tabla + migración (siembra las 3 actuales, Carolina inactiva); servicio analyst_admin; endpoints CRUD; ETL lee de DB (fallback env var); stats por-analista y dropdowns solo activas; página Configuración + hook useAnalysts que reemplaza los hardcodeos.
- OUT: gestión de otras config (fechas ETL, umbrales) — la página queda preparada pero solo con Analistas.

## Principios innegociables
- ETL con fallback al env var si la tabla está vacía (no romper si falla la carga).
- Totales/estado del cliente reflejan la realidad (no se filtran por analista activa).

## Affected modules
- Nuevo: tabla Analyst, migración, `src/services/analyst_admin.py`, endpoints, `dashboard/app/configuracion/page.tsx`, `dashboard/lib/useAnalysts.ts`, tests
- Modificado: `src/etl.py`, `src/services/category_stats.py` (by_analyst activas), `src/main.py` (/stats/summary activas), FilterBar + clientes/analiticas/inicio/reuniones (usan useAnalysts), Sidebar

## Caveat (Google Calendar)
Agregar una analista en la UI hace que el ETL intente bajar su calendario; solo funciona para @dentaldata.es con domain-wide delegation (ya configurado). Externas no (permiso de Google, no bug).

## Rollback plan
`git revert` + downgrade de la migración (drop table analysts). El ETL vuelve al env var.

## Risks
- ETL sin analistas activas → mitigado con fallback al env var.
- Seed en migración → idempotente vía email PK.
