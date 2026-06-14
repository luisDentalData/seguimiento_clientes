# Change 09 — Limpieza pre-GitHub + higiene de lint

## Intent
Dejar el repo limpio y organizado para subir a GitHub: eliminar archivos muertos, deps y config sin uso, y resolver los errores de lint preexistentes que harían fallar el CI (Change 7).

## Why
El repo va a GitHub. Subir basura queda en el historial; mejor limpiar antes. Además, el CI de frontend corre `npm run lint` sobre TODO el proyecto y fallaba por errores preexistentes (descubierto en esta limpieza — la verificación de Change 7 fue incompleta).

## Scope
- IN: borrar archivos basura/muertos; limpiar config y deps muertas; actualizar README; resolver los 13 problemas de lint (incluye refactor de SpainMapLeaflet).
- OUT: features nuevas; rename src→backend.

## Acciones
### Borrados (verificados sin uso)
- `nul` (artefacto Windows), `credentials.json/` (dir vacío)
- `dashboard/components/SpainMap.tsx` (no se importa; se usa SpainMapLeaflet)
- `src/scripts/check_hondarribia.py` (one-off), `src/scripts/inspect_event.py` (debug)
- `src/scripts/init_db.py` (superseded por Alembic)
- `start_dev.bat`, `start_docker.bat`, `start_hybrid.bat`, `stop_docker.bat` (wrappers; comandos van al README)

### Limpieza de código
- `config.py`: removidos CLIENT_DATA_PATH/CRM_DATA_PATH/BASE_DIR/FUZZY_MATCH_THRESHOLD (muertos)
- `requirements.txt`: removidas fuzzywuzzy + python-Levenshtein (sin uso)
- README: comandos actualizados (Docker + sync + alembic), sin referencias a .bat

### Lint (CI verde)
- Warnings: imports sin usar en analiticas/page.tsx y Header.tsx
- Errores: `any` en SyncButton.tsx
- **Refactor SpainMapLeaflet** (Opción B, decidida con el usuario): `dynamic(ssr:false)` movido a la página con import REAL → permite `import L from 'leaflet'` top-level; `require()` eliminado; `any` tipados; map en `useRef` (elimina setState-in-effect).

## Verificación
- Backend: 75 tests verde; config/etl importan.
- Frontend: `tsc --noEmit` y `eslint .` (todo el proyecto) en EXIT 0.
- ⚠️ Pendiente del usuario: VERIFICACIÓN VISUAL del mapa (/mapa) al levantar la app — los chequeos estáticos no detectan "el mapa no se dibujó".

## Rollback plan
`git revert`. Las utilidades borradas (check_db, export, load) que se conservan siguen disponibles.

## Risks
- Refactor del mapa sin verificación visual → mitigado: cambio canónico (Next.js+Leaflet dynamic ssr:false), tsc/eslint verdes, patrón ref estándar; requiere confirmación visual del usuario.
