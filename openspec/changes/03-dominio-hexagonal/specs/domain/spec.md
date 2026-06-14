# Spec Delta — Dominio de reuniones y estado de cliente

## ADDED Requirements

### Requirement: Taxonomía rica de categorización de reuniones
El sistema MUST clasificar cada reunión en una de 6 categorías: CLIENTE, INTERNO, VACACIONES, EVENTO, PERSONAL, SIN_CLASIFICAR, mediante lógica pura (sin DB ni framework).

#### Scenario: Vacaciones como categoría propia
- **GIVEN** un título "vacaciones"
- **WHEN** se clasifica
- **THEN** la categoría es `VACACIONES` (no un cajón ciego)

#### Scenario: Evento profesional externo
- **GIVEN** un título con keyword de evento (ej. "Congreso dental") y asistentes externos
- **WHEN** se clasifica
- **THEN** la categoría es `EVENTO`

#### Scenario: Interno tiene precedencia sobre evento
- **GIVEN** una formación con todos los asistentes @dentaldata.es
- **WHEN** se clasifica
- **THEN** la categoría es `INTERNO` (el evento no roba casos al trabajo interno)

#### Scenario: Cliente tiene precedencia sobre evento
- **GIVEN** un título que menciona un cliente y una keyword de evento
- **WHEN** se clasifica
- **THEN** la categoría es `CLIENTE`

### Requirement: Compatibilidad legacy del Matcher
El `Matcher` MUST seguir devolviendo el contrato legacy (match_status/matched_client_id/match_reason/match_confidence) sin cambios observables.

#### Scenario: Comportamiento preservado
- **GIVEN** la suite de caracterización del Matcher (17 escenarios)
- **WHEN** se refactoriza el Matcher para delegar en el dominio
- **THEN** los 17 tests siguen verdes sin modificarse

### Requirement: Estado del cliente en el dominio
La regla OK/ATTENTION/CRITICAL MUST vivir en el dominio (función pura), basada en días desde la última sesión válida.

#### Scenario: Umbrales
- **GIVEN** N días desde la última sesión válida
- **WHEN** N<=30 → OK; 31<=N<=60 → ATTENTION; N>60 o sin sesiones → CRITICAL
- **THEN** la función devuelve el estado correspondiente
