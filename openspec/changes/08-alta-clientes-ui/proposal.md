# Change 08 — Alta/edición de clientes desde la UI

## Intent
Permitir crear, editar y desactivar clientes (con sus emails de matching) desde el dashboard, eliminando la necesidad de editar `clientes_maestro.json` a mano. La DB pasa a ser la fuente de verdad.

## Decisiones (validadas en brainstorming)
- **Fuente de verdad:** la UI escribe directo a la DB. El JSON queda solo para carga inicial/disaster-recovery.
- **Re-matching:** el alta solo guarda; el re-matching se dispara con el botón Sync existente (POST /etl/run). El matcher lee la DB fresca.
- **Alcance:** Crear + Editar + Desactivar (soft-delete `is_active=false`, nunca borra ni pierde appointments).
- **ID:** autogenerado (`DD-XXXXX`, max + 1).

## Scope
- IN: servicio `client_admin` (create/update/deactivate/next_id), schemas, endpoints POST/PUT/deactivate, formulario en el dashboard.
- IN: extraer helper compartido de sync de emails (DRY con sync_clientes_maestro).
- OUT: borrado físico, importación masiva (ya la cubre JSON+sync), auto-trigger de ETL, testing de frontend (diferido).

## Principios innegociables
- DB como fuente de verdad; sin tocar appointments al desactivar.
- Email único: si pertenece a otro cliente → error claro (NO reasignar silenciosamente desde la UI).
- `nombre_normalizado` se deriva del nombre (consistente con el normalizador del dominio).
- El refactor del helper de emails es behavior-preserving (los tests de sync siguen verdes).

## Affected modules
- Nuevo: `src/services/client_admin.py`, tests
- Modificado: `src/main.py` (endpoints), `src/schemas.py` (ClientAdminCreate/Update), `src/scripts/sync_clientes_maestro.py` (usa el helper compartido), `dashboard/app/clientes/page.tsx` + nuevo `ClientFormModal.tsx`

## Rollback plan
`git revert`. Endpoints aditivos; el soft-delete es reversible (reactivar).

## Risks
- Refactor del email-sync rompe el bulk sync → mitigado por los tests de sync existentes.
- Colisión de ID en alta concurrente → aceptable a esta escala (1 admin); se puede endurecer luego con secuencia DB.
