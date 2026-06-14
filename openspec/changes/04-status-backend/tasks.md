# Tasks — Change 04: Estado del cliente en el backend

## Fase 1: Servicio
- [x] 1.1 `src/services/portfolio.py` con `get_client_portfolio(db, analyst_email, active_only, reference_date)`
- [x] 1.2 SQL agregado (count + max start_time) sin N+1
- [x] 1.3 last_analyst vía DISTINCT ON (sesión más reciente)
- [x] 1.4 Estado vía `domain/clients/status.py` (sin duplicar umbrales)
- [x] 1.5 Orden por prioridad CRITICAL→ATTENTION→OK

## Fase 2: Endpoint
- [x] 2.1 `GET /clients/portfolio` en main.py (filtro analista + active_only)
- [x] 2.2 Fix Boy-Scout: prints con emoji en CORS rompían en cp1252 → [OK]/[WARN]

## Fase 3: Tests (Postgres real)
- [x] 3.1 OK / ATTENTION / CRITICAL por días
- [x] 3.2 Sin sesiones → CRITICAL
- [x] 3.3 INTERNAL/NO_MATCH no cuentan
- [x] 3.4 PROBABLE cuenta
- [x] 3.5 Filtro por analista
- [x] 3.6 last_analyst = sesión más reciente
- [x] 3.7 Orden por prioridad

## Fase 4: Verificación
- [x] 4.1 Suite completa: 55 verde
- [x] 4.2 Sanity import main + ruta registrada
- [x] 4.3 Sanity read-only contra DB real (143 clientes: 72 CRIT / 50 ATT / 21 OK)
- [x] 4.4 Commit

## Resultado
Endpoint /clients/portfolio operativo. Estado calculado en backend reusando el
dominio. 9 tests nuevos (55 total verde). Listo para que el frontend lo consuma (Change 6).
