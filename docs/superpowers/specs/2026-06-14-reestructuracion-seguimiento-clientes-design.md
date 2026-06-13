# Diseño: Reestructuración "Seguimiento Clientes"

**Fecha:** 2026-06-14
**Enfoque:** Big Bang Seguro · Metodología SDD · 1-2 semanas full-time · 1 dev
**Estado:** Aprobado para implementación

---

## 0. Principios de Desarrollo INNEGOCIABLES

Estos principios aplican a TODOS los changes. No son negociables aunque cuesten más trabajo:

- 🚫 **No easy-path.** Nada de atajos que comprometan la integridad del sistema.
- 🚫 **No test-gaming.** Prohibido hardcodear respuestas o ajustar el código solo para que un test pase. Un test verde debe significar que el comportamiento REAL es correcto.
- 🚫 **No mocks que esconden la verdad.** Los tests corren contra Postgres real (Docker), no SQLite. Los mocks solo para fronteras externas (Google Calendar API), nunca para esconder lógica propia.
- 🚫 **No silenciar errores.** Nada de `except: pass` ni swallow. Los errores se manejan o se propagan con contexto.
- 🚫 **No parches temporales.** Ante un fallo, se busca y arregla la CAUSA RAÍZ.
- ✅ **Tests de caracterización ANTES de refactorizar.** Se fija el comportamiento actual antes de tocar matcher/ETL.
- ✅ **Integridad y funcionamiento por encima de la velocidad.**

---

## 1. Objetivo del Sistema (funcionalidad intocable)

El sistema existe para:

1. **Seguimiento de clientes y su estado** (¿hace cuánto no nos reunimos?).
2. **Detectar si los clientes tienen reuniones** con la empresa.
3. **Categorizar correctamente las reuniones del equipo** (interno, vacaciones, eventos, personal).
4. **Analizar la carga de reuniones** por tipo y por analista.
5. 🎯 **Lo más importante:** el seguimiento de las reuniones de los CLIENTES.

La arquitectura puede cambiar radicalmente; estos objetivos NO.

---

## 2. Decisiones de Infraestructura (validadas con el usuario)

| Decisión | Elegido | Razón |
|----------|---------|-------|
| Estructura repo | **Monorepo** | Commits atómicos back+front, un historial, un CI. Óptimo para 1 dev. |
| Arquitectura backend | **Hexagonal pragmática** | `domain/` puro + repositories + services. Testeable sin boilerplate inútil. |
| Test DB | **Postgres real (Docker)** | Tests fieles a prod (regex word-boundary, tipos, JSON). No SQLite. |
| Testing frontend | **Diferido** | El front queda "tonto" tras mover lógica al backend; poco que testear. |
| Driver DB | **pg8000 (mantener)** | Cambiar a psycopg3 es churn sin beneficio a esta escala. |
| Deployment | **GCR (estabilizar)** | No reinventar; solo estabilizar lo existente. |
| Trigger ETL | **Manual (mantener)** | Scheduler automático = escalabilidad = diferido. |
| Umbrales estado | **OK ≤30d / ATENCIÓN 31-60d / CRÍTICO >60d** | Sin cambios. |
| Taxonomía reuniones | **Rica fija** | CLIENTE/INTERNO/VACACIONES/EVENTO/PERSONAL/SIN_CLASIFICAR. |

**Prioridades del usuario (en orden):** Confiabilidad → Seguridad de datos → Performance → Mantenibilidad → Escalabilidad (esta última, diferida).

---

## 3. Taxonomía de Categorización de Reuniones

Reemplaza el actual modelo (CLIENTE/INTERNO/NO_MATCH) que mezclaba vacaciones y eventos en un cajón ciego.

| Categoría | Detección (a refinar en spec) |
|-----------|-------------------------------|
| `CLIENTE` | Email match con `client_emails` O nombre como palabra completa en título |
| `INTERNO` | Todos los asistentes `@dentaldata.es` y sin keywords de otras categorías |
| `VACACIONES` | Keywords: vacaciones, baja, ausencia, libre, festivo, día personal |
| `EVENTO` | Keywords: congreso, feria, formación, webinar, evento, conferencia |
| `PERSONAL` | Keywords: casa, comida, médico, dentista, llamar (filtrado) |
| `SIN_CLASIFICAR` | No encajó en ninguna (revisión manual) |

El orden de precedencia se define en el spec del Change 3. Permite analizar la carga real por tipo.

---

## 4. Estructura Objetivo (Monorepo + Hexagonal pragmática)

```
seguimiento-clientes/
├── backend/
│   ├── domain/                    # REGLAS PURAS (sin FastAPI, sin SQLAlchemy)
│   │   ├── meetings/
│   │   │   ├── category.py        # enum de categorías
│   │   │   └── classifier.py      # lógica de categorización (testeable aislada)
│   │   ├── clients/
│   │   │   └── status.py          # OK/ATENCIÓN/CRÍTICO (traído del frontend)
│   │   └── sync/
│   │       └── groups.py          # config de clínicas (fin del copy-paste x6)
│   ├── infrastructure/
│   │   ├── db/                    # engine, session, repositories
│   │   ├── gcal/                  # Google Calendar (UNA estrategia de auth clara)
│   │   └── config.py              # Pydantic Settings
│   ├── application/
│   │   ├── etl/                   # orquestación (usa repositories, sin queries inline)
│   │   └── api/                   # routers FastAPI delgados (solo HTTP)
│   ├── alembic/                   # migraciones
│   └── tests/                     # pytest + Postgres real (Docker)
├── dashboard/                     # Next.js (queda "tonto": solo muestra)
├── docs/
├── docker-compose.yml
└── .github/workflows/             # CI: lint + test + build
```

**Mejora clave:** las preguntas de negocio (`¿cliente crítico?`, `¿reunión de cliente o vacaciones?`) viven en funciones puras testeables, no enterradas en un ETL de 773 líneas ni en el navegador del usuario.

---

## 5. Secuencia de Implementación (8 changes SDD)

Ordenados por prioridad del usuario y por dependencia técnica. Cada uno es un change SDD con su spec, plan y verificación.

| # | Change | Prioridad | Resultado | Depende de |
|---|--------|-----------|-----------|------------|
| 0 | **Fundación** — git init monorepo + .gitignore (PII/secretos) + primer commit | 🔴 Seguridad | Red de versionado | — |
| 1 | **Red de seguridad** — pytest + Postgres Docker + tests de caracterización (Matcher, ETL) | 🔴 Confiabilidad | Red antes de refactorizar | 0 |
| 2 | **Migraciones** — Alembic + migración inicial + `sync_clientes` con UPSERT + guard anti-`drop_all` en prod | 🔴 Seguridad | Fin del riesgo de pérdida de datos | 0 |
| 3 | **Reestructura backend** — hexagonal pragmática + taxonomía rica | 🟠 Mantenibilidad | Dominio limpio y testeable | 1, 2 |
| 4 | **Status al backend** — endpoint `/clients/portfolio` (cálculo en SQL con `now()`) | 🟠 Funcionalidad | Una sola verdad para todos | 3 |
| 5 | **ETL refactor** — 6 bloques sync → tabla config; eliminar N+1 (matcher y ETL) | 🟠 Performance | 773→~250 líneas, sin roundtrips | 1, 3 |
| 6 | **Migración frontend** — consumir `/clients/portfolio`, error boundaries, borrar cálculo en browser | 🟠 Mantenibilidad | Front "tonto", errores visibles | 4 |
| 7 | **CI/CD** — GitHub Actions (lint + test + build) | 🟠 Confiabilidad | Nada roto llega a main | 1 |

### Diferido (Escalabilidad — backlog explícito)
- Valkey/cache (email-map, stats)
- Paginación real (cursor + total count)
- Cloud Scheduler para ETL automático

---

## 6. Cómo cada Change preserva la funcionalidad objetivo

- **Seguimiento de clientes + estado** → Change 4 lo hace MÁS robusto (backend, no browser).
- **¿Tienen reuniones?** → intacto, mejorado con el matcher testeado (Change 1 + 5).
- **Categorizar reuniones del equipo** → Change 3 lo EXPANDE (taxonomía rica).
- **Analizar carga** → ahora posible por tipo de reunión (antes imposible con NO_MATCH ciego).

---

## 7. Definición de Éxito

- ✅ Todos los tests verdes (contra Postgres real) antes de cada deploy.
- ✅ Agregar un cliente = 1 comando seguro (UPSERT, sin `drop_all`).
- ✅ Estado del cliente idéntico para todos los analistas (calculado en backend).
- ✅ Reuniones categorizadas en 6 tipos analizables.
- ✅ ETL sin N+1, sin copy-paste, < 300 líneas.
- ✅ CI bloquea merges con tests rojos o lint fallido.
- ✅ Cero secretos/PII en el historial de git.

---

## 8. Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| PII/secretos en git | `.gitignore` exhaustivo ANTES del primer commit; CSVs y `clientes_maestro.json` fuera del repo. |
| Refactor del matcher rompe matching | Tests de caracterización (Change 1) ANTES de tocarlo (Change 5). |
| Pérdida de datos en migración | Backup de la DB antes de la parada controlada; Alembic con `downgrade`. |
| Downtime | Parada controlada acordada (el sistema no es 24/7 crítico). |

---

## 9. Manejo de PII y Secretos (decisión)

Se EXCLUYEN del repositorio (van por canal seguro a colaboradores):
- `clientes_maestro.json` (seed con NIF, teléfonos, direcciones)
- `clients.csv`, `appointments.csv`, `client_emails.csv` (exports derivados con PII)
- `credentials.json`, `client_secret_oauth.json`, `token.pickle`, `.env`

Se documenta en el README cómo obtenerlos para levantar el proyecto.
