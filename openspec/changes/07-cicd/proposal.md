# Change 07 — CI/CD (GitHub Actions)

## Intent
Pipeline de integración continua que en cada push/PR corre: backend (pytest contra Postgres real de servicio) + frontend (type-check + lint). Cierra el círculo de Confiabilidad: nada roto llega a main.

## Why
Prioridad #1 (Confiabilidad). Tener 66 tests no sirve si no se corren automáticamente. CI garantiza que cada cambio pasa por la red de seguridad.

## Scope
- IN: `.github/workflows/ci.yml` con jobs backend y frontend.
- OUT: deploy automático a GCR (escalabilidad/ops, fuera de alcance), backend lint (ruff/mypy aún no instalados).

## Affected modules
- Nuevo: `.github/workflows/ci.yml`

## Detalle
- Backend: Postgres 14 como service, instala requirements + requirements-dev, corre pytest. conftest crea `dentaldata_test` sobre el service vía TEST_DATABASE_URL.
- Frontend: npm ci + tsc --noEmit + eslint.

## Rollback plan
`git revert` (solo agrega un workflow).

## Risks
- Que el service Postgres no matchee credenciales del conftest → mitigado: POSTGRES_USER/PASSWORD/DB = postgres/dentaldata/dentaldata, igual que el default del conftest.
