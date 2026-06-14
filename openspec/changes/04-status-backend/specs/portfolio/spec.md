# Spec Delta — Endpoint de portfolio de clientes

## ADDED Requirements

### Requirement: Estado de seguimiento calculado en el backend
El sistema MUST exponer `GET /clients/portfolio` que devuelve, por cliente, su estado (OK/ATTENTION/CRITICAL), días sin sesión válida, conteo de sesiones válidas y último analista — calculado en el servidor.

#### Scenario: Sesión reciente → OK
- **GIVEN** un cliente con última sesión válida hace 10 días
- **WHEN** se consulta el portfolio
- **THEN** su estado es OK, days_since=10, valid_sessions>=1

#### Scenario: Sin sesiones válidas → CRITICAL
- **GIVEN** un cliente sin sesiones válidas
- **WHEN** se consulta el portfolio
- **THEN** estado CRITICAL, last_session null, days_since null, valid_sessions 0

#### Scenario: Solo cuentan sesiones válidas
- **GIVEN** un cliente con appointments INTERNAL/NO_MATCH (is_client_meeting=false)
- **WHEN** se consulta el portfolio
- **THEN** valid_sessions=0 (no cuentan como sesión de cliente)

#### Scenario: PROBABLE cuenta como válida
- **GIVEN** un cliente con una sesión PROBABLE
- **WHEN** se consulta el portfolio
- **THEN** valid_sessions=1

#### Scenario: Filtro por analista
- **GIVEN** un cliente con sesión del analista A
- **WHEN** se consulta filtrando por analista B
- **THEN** esa sesión no cuenta para ese filtro

#### Scenario: Último analista
- **GIVEN** un cliente con sesiones de distintos analistas en distintas fechas
- **WHEN** se consulta el portfolio
- **THEN** last_analyst es el de la sesión MÁS reciente

#### Scenario: Orden por prioridad
- **GIVEN** clientes CRITICAL y OK
- **WHEN** se consulta el portfolio
- **THEN** los CRITICAL aparecen antes que los OK
