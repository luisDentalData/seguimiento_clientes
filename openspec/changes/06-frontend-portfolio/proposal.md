# Change 06 — Frontend consume /clients/portfolio (front "tonto")

## Intent
Que la página de Clientes consuma el endpoint `/clients/portfolio` (estado calculado en el backend) en vez de calcular el estado en el navegador. Agregar manejo de errores visible y cargar el historial bajo demanda.

## Why
Prioridad #4 (Mantenibilidad) + correctitud. El cálculo en el browser dependía del reloj de cada usuario (dos analistas veían estados distintos). Y si el backend fallaba, la tabla aparecía vacía sin avisar.

## Scope
- IN: `dashboard/app/clientes/page.tsx` consume `/clients/portfolio?analyst_email=`; borra el cálculo de estado en el browser; banner de error; historial del modal bajo demanda (`/appointments?matched_client_id=`).
- IN: tipo `PortfolioClient` + `ClientStatus` en `lib/types.ts`.
- OUT: testing de frontend (diferido por decisión de diseño). Otras páginas (overview/reuniones/mapa/analiticas) — no se tocan en este change.

## Principios innegociables
- El front no recalcula reglas de negocio: confía en el backend (incluyendo el orden por prioridad).
- Búsqueda/filtro de estado/orden por fecha son SOLO presentación.
- Errores del backend deben ser VISIBLES (no tabla vacía silenciosa).

## Affected modules
- `dashboard/app/clientes/page.tsx` (reescrita, ~620→~470 líneas, sin lógica de negocio)
- `dashboard/lib/types.ts` (+PortfolioClient)

## Verificación (sin tests de frontend, por decisión)
- `tsc --noEmit` limpio.
- `eslint` limpio.
- NO se ejecutó el navegador (regla: no build) — verificación estática + revisión.

## Rollback plan
`git revert`. Cambio aislado a la página de Clientes + un tipo nuevo.

## Risks
- Sin tests de frontend → mitigado con type-check estricto + lint + que el estado lo calcula (y testea) el backend.
