# Spec Delta — Página de Clientes consume el backend

## ADDED Requirements

### Requirement: El estado del cliente proviene del backend
La página de Clientes MUST mostrar el estado (OK/ATTENTION/CRITICAL) tal como lo devuelve `/clients/portfolio`, sin recalcularlo en el navegador.

#### Scenario: Render directo del estado del backend
- **GIVEN** la respuesta de `/clients/portfolio`
- **WHEN** se renderiza la tabla
- **THEN** el estado, días sin sesión, conteo y último analista se muestran tal cual vienen del backend

#### Scenario: Filtro por analista server-side
- **GIVEN** el usuario selecciona un analista
- **WHEN** cambia el filtro
- **THEN** se vuelve a pedir `/clients/portfolio?analyst_email=...` (el backend recalcula)

### Requirement: Errores visibles
La página MUST informar al usuario si el backend falla, en vez de mostrar una tabla vacía.

#### Scenario: Backend caído
- **GIVEN** que `/clients/portfolio` falla
- **WHEN** se carga la página
- **THEN** se muestra un banner de error (no una tabla vacía silenciosa)

### Requirement: Historial bajo demanda
El historial de reuniones de un cliente MUST cargarse al abrir el modal, no en bulk.

#### Scenario: Abrir historial
- **GIVEN** un cliente en la tabla
- **WHEN** el usuario abre su historial
- **THEN** se pide `/appointments?matched_client_id={id}` solo en ese momento
