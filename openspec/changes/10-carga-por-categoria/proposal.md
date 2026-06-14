# Change 10 — Vista de carga de reuniones por categoría

## Intent
Cerrar el objetivo de negocio que motivó la taxonomía rica: mostrar y analizar la carga del equipo por tipo de reunión (cliente, interno, vacaciones, evento, personal). La `category` ya se persiste (Change 5); faltaba la pantalla.

## Decisiones (brainstorming)
- **Ubicación:** sección nueva dentro de `/analiticas` (reusa recharts + FilterBar).
- **Cortes:** total + por analista + por mes.
- **Filtros:** total y por-analista respetan analista+mes del FilterBar; por-mes ignora el mes (para mostrar la serie temporal), respeta analista.

## Scope
- IN: servicio `category_stats` + endpoint `GET /stats/categories`; sección con 3 gráficos en Analíticas.
- OUT: testing de frontend (diferido). Auto-poblado de category (depende del re-ETL).

## Principios innegociables
- Backend agrega; el front solo dibuja.
- Reuniones sin categoría (NULL pre-ETL) se muestran como SIN_CLASIFICAR (no se esconden).

## Affected modules
- Nuevo: `src/services/category_stats.py`, tests, sección en `dashboard/app/analiticas/page.tsx`
- Modificado: `src/main.py` (endpoint), `dashboard/lib/types.ts` (CategoryStats)

## Verificación
- Backend: 6 tests nuevos (81 total verde); sanity contra DB real (todo SIN_CLASIFICAR hasta re-ETL — esperado).
- Frontend: tsc + eslint . EXIT 0 (proyecto entero).
- ⚠️ Pendiente del usuario: verificación visual de los gráficos al levantar la app.

## Rollback plan
`git revert`. Endpoint y sección aditivos.

## Risks
- Sin tests de front → mitigado con tsc/eslint + backend testeado.
- by_month con to_char fallaba en GROUP BY → resuelto agregando por mes en Python (dataset chico).
