# Spec Delta — Testing del Matcher (caracterización)

## ADDED Requirements

### Requirement: Infraestructura de testing con Postgres real
El proyecto MUST tener un runner pytest que ejecute tests contra una base PostgreSQL real (la misma de Docker), NO SQLite.

#### Scenario: Aislamiento entre tests
- **GIVEN** un test que inserta clientes en la base de test
- **WHEN** el test termina
- **THEN** los datos se revierten (transacción + rollback) y el siguiente test ve una base limpia

#### Scenario: La base de test se crea automáticamente
- **GIVEN** que la base `dentaldata_test` no existe
- **WHEN** se corre la suite por primera vez
- **THEN** la base se crea y se crean todas las tablas del modelo

### Requirement: Caracterización del Matcher
La suite MUST fijar el comportamiento ACTUAL de `Matcher.match_appointment` para cada rama de decisión.

#### Scenario: Evento personal
- **GIVEN** un summary que es exactamente una keyword personal (ej. "comida") o empieza con keyword de recordatorio (ej. "Llamar...")
- **WHEN** se evalúa el matching
- **THEN** el resultado es `NO_MATCH` con confidence `0.0`

#### Scenario: Precedencia personal sobre interno
- **GIVEN** un summary personal con asistentes todos `@dentaldata.es`
- **WHEN** se evalúa
- **THEN** el resultado es `NO_MATCH` (personal gana), NO `INTERNAL`

#### Scenario: Reunión interna
- **GIVEN** todos los asistentes `@dentaldata.es` y summary no-personal
- **WHEN** se evalúa
- **THEN** el resultado es `INTERNAL` con confidence `1.0`

#### Scenario: Match por email exacto
- **GIVEN** un asistente cuyo email (case-insensitive) está en `client_emails`
- **WHEN** se evalúa
- **THEN** el resultado es `CONFIRMED` con confidence `1.0` y el `matched_client_id` correcto

#### Scenario: Match por nombre con límite de palabra
- **GIVEN** el nombre normalizado del cliente aparece como palabra completa en el título
- **WHEN** se evalúa
- **THEN** `CONFIRMED` con confidence `0.98`

#### Scenario: Guard anti-substring (regresión antia/garantia)
- **GIVEN** un cliente "antia dental" y un título "...garantia dental..."
- **WHEN** se evalúa
- **THEN** NO matchea por substring (resultado `NO_MATCH` si no hay otro match)

#### Scenario: PROBABLE actualmente inalcanzable
- **GIVEN** cualquier match por nombre (scores 0.92–0.98)
- **WHEN** se evalúa
- **THEN** el resultado es siempre `CONFIRMED` (la banda PROBABLE 0.75–0.90 es código muerto hoy)
