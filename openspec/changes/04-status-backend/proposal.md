# Change 04 — Estado del cliente en el backend (/clients/portfolio)

## Intent
Traer el cálculo del estado de seguimiento (OK/ATTENTION/CRITICAL) del navegador al backend, exponiéndolo en `GET /clients/portfolio`, para que sea UNA sola verdad para todos los analistas.

## Why
Hoy el estado se calcula en el browser (`dashboard/app/clientes/page.tsx`), dependiendo del reloj/timezone de cada usuario → dos analistas ven estados distintos del mismo cliente. Es el objetivo central (seguimiento del estado) y debe ser consistente y autoritativo.

## Scope
- IN: servicio `get_client_portfolio` (SQL agregado, sin N+1) + endpoint `/clients/portfolio`. Reusa `domain/clients/status.py`.
- IN: filtro por analista, orden por prioridad (CRITICAL→ATTENTION→OK), last_analyst, días sin sesión.
- OUT: migración del frontend a este endpoint (Change 6). Categoría de reunión en appointments (Change 5).

## Principios innegociables
- El estado lo decide el DOMINIO (classify_client_status), NO se duplican umbrales en SQL.
- Sin N+1: agregados con GROUP BY + DISTINCT ON.
- `reference_date` inyectable para tests deterministas.

## Affected modules
- Nuevo: `src/services/portfolio.py`
- Modificado: `src/main.py` (endpoint + fix de prints con emoji que rompían en cp1252)

## Rollback plan
`git revert`. El endpoint es aditivo; no cambia endpoints existentes ni datos.

## Risks
- Sesión válida mal definida → cubierto con tests (solo CONFIRMED/PROBABLE + is_client_meeting).
- Flakiness por "hoy" → mitigado con reference_date inyectable.
