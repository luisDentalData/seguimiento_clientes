# Skill Registry — Seguimiento Clientes

Infraestructura para SDD. Los sub-agentes reciben estas reglas pre-digeridas (no leen SKILL.md).

## Project Conventions (auto-resolved)

### Principios INNEGOCIABLES (de docs/.../2026-06-14-...-design.md §0 y CLAUDE.md global)
- 🚫 No easy-path. No test-gaming (no hardcodear respuestas para pasar tests).
- 🚫 No mocks que esconden lógica propia. Mocks SOLO para fronteras externas (Google Calendar API).
- 🚫 No silenciar errores (`except: pass` prohibido). Manejar o propagar con contexto.
- 🚫 No parches temporales. Buscar y arreglar la CAUSA RAÍZ.
- ✅ Tests contra Postgres real (Docker), NO SQLite.
- ✅ Tests de caracterización ANTES de refactorizar matcher/ETL.
- ✅ Conventional commits. NUNCA añadir "Co-Authored-By" ni atribución AI.

### Stack
- Backend: Python 3.12, FastAPI, SQLAlchemy 2.0, pg8000, Pydantic 2.
- Frontend: Next.js 16, React 19, TypeScript 5.9, Tailwind 4.
- Arquitectura objetivo: Hexagonal pragmática (domain / infrastructure / application).

## Compact Rules

### Python / pytest (Change 1+)
- pytest como runner. Fixtures para sesión de DB contra Postgres real (Docker).
- Tests de caracterización: capturan comportamiento ACTUAL antes de tocarlo. No deben "arreglar" bugs, solo fijar lo que hay.
- Nombres descriptivos: `test_<unidad>_<escenario>_<resultado_esperado>`.
- Sin lógica de negocio en los tests; usar fixtures/factories.

### FastAPI / SQLAlchemy
- Routers delgados (solo HTTP). Lógica en domain/application.
- Repositories para acceso a datos; nada de queries inline en endpoints/ETL.
- Pydantic Settings para config; nada de `os.getenv` disperso.

### Frontend (Next.js) — diferido para testing
- eslint + tsc disponibles. Componentes "tontos": solo presentación.
- Error boundaries y manejo de errores SWR obligatorios (Change 6).

## Project Convention Files
- `CLAUDE.md` (raíz) — guía operativa del proyecto.
- `~/.claude/CLAUDE.md` (global) — estándares de dev, reglas de commits, personalidad.
- `docs/superpowers/specs/2026-06-14-reestructuracion-seguimiento-clientes-design.md` — plan maestro.

## Relevant User Skills (by trigger)
| Trigger context | Skill |
|---|---|
| Escribir tests, refactorizar con red | test-driven-development |
| Debuggear fallos de tests/comportamiento | systematic-debugging |
| Tests Python/fixtures | (aplicar Compact Rules de pytest arriba) |
