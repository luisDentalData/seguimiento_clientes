# Change 01 — Red de Seguridad (tests de caracterización)

## Intent
Establecer la infraestructura de testing (pytest + Postgres real vía Docker) y escribir **tests de caracterización** que fijen el comportamiento ACTUAL del `Matcher` ANTES de refactorizarlo en changes posteriores (3 y 5).

## Why
Prioridad #1 del proyecto: Confiabilidad. Hoy hay 0 tests sobre 773 líneas de ETL y un matcher que ya tuvo el bug "antia/garantia". Sin una red que detecte cambios de comportamiento, cada refactor es una ruleta.

## Scope
- IN: pytest config, fixtures con Postgres real (Docker, NO SQLite), suite de caracterización del `Matcher` (`src/services/matching.py`).
- IN: `requirements-dev.txt` para deps de testing.
- OUT (diferido): tests del ETL completo (depende de Google Calendar; se aborda con mocks de frontera en change posterior), tests de frontend (diferidos por decisión de diseño), refactor del matcher (Change 3/5).

## Principios innegociables (de design §0)
- Tests de caracterización capturan el comportamiento REAL leído del código, NO comportamiento inventado.
- Postgres real, no SQLite. Mocks solo para fronteras externas.
- Si se detecta un bug/quirk, se DOCUMENTA en el test (no se enshrina en silencio ni se "arregla" acá).

## Affected modules
- `src/services/matching.py` (solo lectura — no se modifica en este change)
- Nuevos: `tests/`, `pytest.ini`, `requirements-dev.txt`

## Rollback plan
Todo es aditivo (tests + config). Rollback = borrar `tests/`, `pytest.ini`, `requirements-dev.txt`. No toca código de producción ni datos.

## Risks
- Que un test de caracterización "endurezca" un bug. Mitigación: cada quirk conocido se marca con docstring explícito (`KNOWN RISK`), para refactorizarlo conscientemente después.
