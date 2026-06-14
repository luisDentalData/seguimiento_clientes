# Tasks — Change 09: Limpieza pre-GitHub + lint

## Fase 1: Borrado de muertos
- [x] 1.1 nul, credentials.json/ (dir vacío)
- [x] 1.2 SpainMap.tsx (no usado)
- [x] 1.3 check_hondarribia.py, inspect_event.py, init_db.py
- [x] 1.4 4 scripts .bat (comandos → README)

## Fase 2: Código y deps muertas
- [x] 2.1 config.py: removidos paths legacy + BASE_DIR + FUZZY_MATCH_THRESHOLD
- [x] 2.2 requirements.txt: removidas fuzzywuzzy + python-Levenshtein
- [x] 2.3 README: comandos Docker/sync/alembic, sin .bat

## Fase 3: Lint (CI verde)
- [x] 3.1 Imports sin usar (analiticas, Header)
- [x] 3.2 SyncButton: any → unknown tipado
- [x] 3.3 Refactor SpainMapLeaflet (dynamic ssr:false real + import L + useRef + tipos)

## Fase 4: Verificación
- [x] 4.1 Backend 75 verde; config/etl importan
- [x] 4.2 tsc --noEmit EXIT 0
- [x] 4.3 eslint . (proyecto entero) EXIT 0
- [ ] 4.4 ⚠️ Verificación VISUAL del mapa (/mapa) — PENDIENTE del usuario al levantar la app
- [x] 4.5 Commits

## Resultado
Repo limpio para GitHub. CI de frontend ahora pasaría (lint en 0). Mapa refactorizado
al patrón canónico Next.js+Leaflet. Falta SOLO confirmación visual del mapa por el usuario.
