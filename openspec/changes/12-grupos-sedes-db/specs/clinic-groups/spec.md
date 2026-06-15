# Spec Delta — Grupos de sedes en DB

## ADDED Requirements

### Requirement: Grupos como entidad de DB
El sistema MUST persistir grupos de sedes en `clinic_groups` y asociar clientes vía `clients.group_id` (nullable).

#### Scenario: Migración siembra grupos actuales
- **GIVEN** la config previa (10 grupos)
- **WHEN** se aplica la migración
- **THEN** existen los 10 grupos y sus sedes tienen el group_id correspondiente

### Requirement: El sync lee los grupos de la DB
El ETL MUST construir los grupos desde `clients.group_id`, no desde código.

#### Scenario: Sync simétrico desde DB
- **GIVEN** dos clientes con el mismo group_id y una reunión en uno de ellos
- **WHEN** corre el sync
- **THEN** ambos terminan con la reunión (simétrico, sin importar en cuál cayó)

### Requirement: Gestión de grupos desde la UI
El sistema MUST permitir crear, renombrar, borrar grupos y asignar/quitar sedes vía API.

#### Scenario: Crear grupo y asignar sede
- **GIVEN** un grupo nuevo y un cliente
- **WHEN** se asigna el cliente al grupo y corre el sync
- **THEN** el cliente comparte las reuniones del grupo

#### Scenario: Quitar sede regenera y limpia duplicados
- **GIVEN** una sede en un grupo con reuniones duplicadas (`_DD-`)
- **WHEN** se la quita del grupo
- **THEN** sus duplicados copiados se borran, sus ORIGINALES se conservan, y el grupo se re-sincroniza coherente

#### Scenario: Borrar grupo deja sedes sin grupo
- **GIVEN** un grupo con sedes
- **WHEN** se borra el grupo
- **THEN** las sedes quedan con group_id NULL (no se borran clientes) y se limpian sus duplicados

### Requirement: Integridad de la regeneración
La limpieza MUST borrar solo duplicados (id con `_DD-`), nunca appointments originales.

#### Scenario: Originales intactos
- **GIVEN** una sede con originales y duplicados
- **WHEN** se regenera/limpia su grupo
- **THEN** los originales permanecen y solo se borran/recrean los duplicados
