# Change 03 — Capa de dominio (hexagonal pragmática) + taxonomía rica

## Intent
Extraer la lógica de negocio a una capa `domain/` pura (sin SQLAlchemy ni FastAPI), introducir la taxonomía rica de reuniones (6 categorías) y la regla de estado del cliente, y refactorizar el `Matcher` para que sea un adaptador delgado sobre el dominio — preservando su contrato actual.

## Why
Prioridad #4 (Mantenibilidad) + base para Change 4/5. Hoy la lógica está derramada (matcher + ETL + browser). Centralizarla en funciones puras la hace testeable de forma aislada y habilita analizar la carga por tipo de reunión (objetivo del negocio).

## Decisión de scope (transparente)
NO se renombra `src/` → `backend/`. Ese rename físico es cosmético y de alto churn; mezclarlo con cambios de lógica impide revisar el diff. La capa `domain/` se entrega DENTRO de `src/`. El rename queda como change mecánico aparte (opcional).

## Scope
- IN: `src/domain/meetings/` (category + classifier puro), `src/domain/clients/status.py`, refactor de `Matcher` a adaptador.
- OUT: cableado de la categoría a `appointments` (Change 5 — ETL + migración), endpoint `/clients/portfolio` (Change 4), rename src→backend.

## Principios innegociables
- El refactor del Matcher es BEHAVIOR-PRESERVING: los 17 tests de caracterización DEBEN seguir verdes SIN modificarlos.
- Las categorías nuevas (VACACIONES/EVENTO) NO le roban casos a CLIENTE ni a INTERNO (precedencia conservadora).
- El dominio es PURO: sin imports de SQLAlchemy/FastAPI.

## Affected modules
- Nuevo: `src/domain/**`
- Modificado: `src/services/matching.py` (ahora adaptador)

## Rollback plan
`git revert` del commit. El contrato legacy de `match_appointment` no cambió, así que ETL/API no se ven afectados.

## Risks
- Que el refactor altere el matching → mitigado por los 17 tests de caracterización (verificados verdes post-refactor).
- Cambio de comportamiento sutil en categorías nuevas → cubierto con tests de dominio + precedencia conservadora.
