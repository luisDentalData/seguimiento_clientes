# Spec Delta — Carga de clientes no-destructiva

## ADDED Requirements

### Requirement: Sincronización por UPSERT (no destructiva)
El sistema MUST poder cargar/actualizar clientes desde el maestro SIN borrar tablas ni afectar `appointments`.

#### Scenario: Actualizar cliente existente preserva appointments
- **GIVEN** un cliente existente con appointments asociados
- **WHEN** se sincroniza el maestro con datos actualizados de ese cliente
- **THEN** los datos del cliente se actualizan Y todos sus appointments siguen existiendo

#### Scenario: Alta de cliente nuevo
- **GIVEN** un cliente que no existe en la base
- **WHEN** se sincroniza el maestro que lo incluye
- **THEN** el cliente se inserta sin tocar el resto

#### Scenario: Idempotencia
- **GIVEN** un maestro
- **WHEN** se sincroniza dos veces seguidas
- **THEN** el resultado es idéntico y no hay emails duplicados

#### Scenario: Email huérfano se elimina
- **GIVEN** un cliente con emails [a, b] en la base
- **WHEN** se sincroniza con emails [a] para ese cliente
- **THEN** el email b se elimina y a permanece

### Requirement: Guard anti-destructivo
El script destructivo (`load_clientes_maestro.py`) MUST negarse a dropear tablas salvo flag explícito.

#### Scenario: Bloqueo por defecto
- **GIVEN** que no está seteada la variable `ALLOW_DESTRUCTIVE_LOAD`
- **WHEN** se invoca la operación destructiva
- **THEN** se lanza un error y NO se dropean tablas

#### Scenario: Habilitado explícitamente
- **GIVEN** `ALLOW_DESTRUCTIVE_LOAD=yes`
- **WHEN** se invoca
- **THEN** la operación procede (solo para disaster recovery)

### Requirement: Migraciones de esquema versionadas
El esquema MUST gestionarse con Alembic.

#### Scenario: Baseline crea el esquema completo
- **GIVEN** una base de datos vacía
- **WHEN** se corre `alembic upgrade head`
- **THEN** se crean las tablas `clients`, `client_emails`, `appointments` con sus columnas
