# Tasks — Change 01: Red de Seguridad

## Fase 1: Infraestructura de testing
- [x] 1.1 Crear `requirements-dev.txt` (pytest, pytest-cov)
- [x] 1.2 Crear `pytest.ini` (pythonpath, testpaths)
- [x] 1.3 Crear `tests/conftest.py` con:
  - fixture `engine` (crea base `dentaldata_test` + tablas)
  - fixture `db_session` (transacción + rollback por test)
  - fixture `client_factory` (sembrar clientes/emails)
  - fixture `matcher`

## Fase 2: Tests de caracterización del Matcher
- [x] 2.1 Eventos personales (keyword exacta + prefijo recordatorio)
- [x] 2.2 Precedencia personal sobre interno
- [x] 2.3 Reunión interna (todos @dentaldata.es)
- [x] 2.4 Asistentes mixtos → no interno
- [x] 2.5 Match por email exacto (case-insensitive)
- [x] 2.6 Match por nombre normalizado (0.98)
- [x] 2.7 Match base 2-palabras (0.93) — KNOWN RISK documentado
- [x] 2.8 Match por nombre de contacto (0.94)
- [x] 2.9 Match por nombre alternativo (0.96)
- [x] 2.10 Guard anti-substring (antia/garantia)
- [x] 2.11 PROBABLE inalcanzable (siempre CONFIRMED)
- [x] 2.12 Sin coincidencias → NO_MATCH
- [x] 2.13 Normalización (acentos) y `_word_match` (límite de palabra)

## Fase 3: Verificación
- [x] 3.1 Correr la suite contra Postgres real (Docker) — 17 verde
- [x] 3.2 Sanity check: mutación 0.98→0.50 → test FALLA → restaurado → 17 verde (tests no vacíos)
- [x] 3.3 Commit (bundle con scaffolding SDD)

## Resultado
17 tests de caracterización verdes contra Postgres real. Comportamiento del Matcher
fijado (incluyendo 3 KNOWN RISKS para refactorizar en Change 3/5: vacaciones→NO_MATCH,
match base 2-palabras 0.93, banda PROBABLE inalcanzable).
