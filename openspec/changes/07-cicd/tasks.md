# Tasks — Change 07: CI/CD

## Fase 1: Pipeline
- [x] 1.1 `.github/workflows/ci.yml` con triggers push + pull_request
- [x] 1.2 Job backend: Postgres service + requirements + pytest (TEST_DATABASE_URL)
- [x] 1.3 Job frontend: npm ci + tsc --noEmit + eslint

## Fase 2: Verificación
- [x] 2.1 YAML parsea OK (2 jobs, triggers correctos)
- [x] 2.2 Suite local 66 verde (lo que correrá el job backend)
- [x] 2.3 tsc + eslint verdes localmente (lo que correrá el job frontend)
- [x] 2.4 Commit

## Resultado
CI configurado. Cada push/PR corre los 66 tests contra Postgres real + type-check
y lint del frontend. Nada roto llega a main.
NOTA: el pipeline se ejecuta cuando exista un remoto en GitHub con Actions habilitado.
