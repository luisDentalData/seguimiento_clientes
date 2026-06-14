# Spec Delta — Sincronización config-driven y categoría persistida

## ADDED Requirements

### Requirement: Sincronización de clínicas guiada por configuración
La duplicación de appointments entre clínicas que comparten reuniones MUST estar guiada por una tabla de configuración (no copy-paste).

#### Scenario: Forward sync crea duplicado
- **GIVEN** una clínica fuente con un appointment y una clínica destino configurada
- **WHEN** se ejecuta el sync
- **THEN** se crea un appointment con id `{id_fuente}_{id_destino}` apuntando al destino

#### Scenario: Idempotencia
- **GIVEN** un sync ya ejecutado
- **WHEN** se ejecuta de nuevo
- **THEN** no se crean duplicados nuevos (se actualizan los existentes)

#### Scenario: Bidireccional
- **GIVEN** un grupo bidireccional (fuente↔destino) con appointments originales en ambos
- **WHEN** se ejecuta el sync
- **THEN** se sincroniza en ambos sentidos sin re-sincronizar duplicados ya creados

#### Scenario: Exclusión de duplicados como fuente
- **GIVEN** un appointment que ya es un duplicado sincronizado (id contiene `_DD-`)
- **WHEN** se ejecuta el sync
- **THEN** ese duplicado NO se usa como fuente

### Requirement: Categoría rica persistida
El ETL MUST guardar la categoría de la taxonomía rica en `appointments.category`.

#### Scenario: Categoría almacenada
- **GIVEN** un evento clasificado por el dominio
- **WHEN** el ETL lo procesa
- **THEN** `appointments.category` contiene la categoría (CLIENTE/INTERNO/VACACIONES/EVENTO/PERSONAL/SIN_CLASIFICAR)

### Requirement: Sin N+1 en el ETL
El ETL MUST evitar consultas por evento.

#### Scenario: Nombre de cliente sin query extra
- **GIVEN** el matcheo de un evento a un cliente
- **WHEN** se loguea el nombre del cliente
- **THEN** se resuelve desde cache en memoria (sin query adicional)
