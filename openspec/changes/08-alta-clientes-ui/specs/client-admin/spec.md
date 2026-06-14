# Spec Delta — Administración de clientes desde la UI

## ADDED Requirements

### Requirement: Crear cliente
El sistema MUST permitir crear un cliente con ID autogenerado, sus datos y emails, vía `POST /clients`.

#### Scenario: Alta con ID autogenerado
- **GIVEN** que el mayor ID es DD-00153
- **WHEN** se crea un cliente
- **THEN** recibe el ID DD-00154 y queda activo

#### Scenario: Nombre obligatorio
- **GIVEN** un alta sin nombre
- **WHEN** se intenta crear
- **THEN** se rechaza con error de validación (400)

#### Scenario: Email duplicado de otro cliente
- **GIVEN** un email que ya pertenece a otro cliente
- **WHEN** se intenta crear/editar con ese email
- **THEN** se rechaza con conflicto (409), sin reasignar silenciosamente

#### Scenario: nombre_normalizado derivado
- **GIVEN** un alta con nombre "Clínica Peña" y sin nombre_normalizado
- **WHEN** se crea
- **THEN** nombre_normalizado queda normalizado ("clinica pena")

### Requirement: Editar cliente
El sistema MUST permitir editar datos y emails de un cliente vía `PUT /clients/{id}`.

#### Scenario: Actualiza datos y emails
- **GIVEN** un cliente existente
- **WHEN** se editan nombre y lista de emails
- **THEN** se actualizan los datos y los emails se sincronizan (alta/baja), sin tocar appointments

#### Scenario: Cliente inexistente
- **GIVEN** un id que no existe
- **WHEN** se intenta editar
- **THEN** 404

### Requirement: Desactivar cliente (soft-delete)
El sistema MUST permitir desactivar un cliente vía `POST /clients/{id}/deactivate`.

#### Scenario: Soft-delete preserva historial
- **GIVEN** un cliente con appointments
- **WHEN** se desactiva
- **THEN** is_active=false y sus appointments NO se borran
