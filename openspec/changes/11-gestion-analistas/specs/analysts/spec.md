# Spec Delta — Gestión de analistas

## ADDED Requirements

### Requirement: Analista como entidad
El sistema MUST persistir analistas en una tabla (email, name, is_active) gestionable vía API.

#### Scenario: Listar analistas activas
- **GIVEN** analistas activas e inactivas
- **WHEN** se piden con active_only=true
- **THEN** solo se devuelven las activas

#### Scenario: Alta de analista
- **GIVEN** un email @dentaldata.es y un nombre
- **WHEN** se crea
- **THEN** queda activa y disponible para el próximo ETL

#### Scenario: Email duplicado
- **GIVEN** un email que ya existe
- **WHEN** se intenta crear
- **THEN** se rechaza (409)

#### Scenario: Desactivar analista
- **GIVEN** una analista activa con reuniones
- **WHEN** se desactiva
- **THEN** is_active=false y sus reuniones NO se borran

### Requirement: ETL lee analistas de la DB
El ETL MUST obtener los calendarios a sincronizar desde las analistas activas en DB.

#### Scenario: Fuente dinámica
- **GIVEN** analistas activas en la tabla
- **WHEN** corre el ETL
- **THEN** baja los calendarios de esas analistas (no del env var)

#### Scenario: Fallback de seguridad
- **GIVEN** la tabla de analistas vacía
- **WHEN** corre el ETL
- **THEN** usa ANALYST_EMAILS del env var como respaldo

### Requirement: Ocultar analista desactivada como dimensión
Las analistas inactivas MUST NO aparecer en dropdowns ni en el desglose por analista, PERO sus sesiones SIGUEN contando para el estado del cliente y los totales.

#### Scenario: Desglose por analista solo activas
- **GIVEN** una analista desactivada con reuniones
- **WHEN** se pide el desglose por analista
- **THEN** esa analista no aparece

#### Scenario: El estado del cliente no cambia al desactivar
- **GIVEN** un cliente con su última sesión hecha por una analista que se desactiva
- **WHEN** se recalcula el portfolio
- **THEN** esa sesión sigue contando (el cliente no salta a CRÍTICO por la baja)
