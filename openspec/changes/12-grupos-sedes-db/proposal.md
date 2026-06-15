# Change 12 — Grupos de sedes como entidad de DB gestionable

## Intent
Convertir los grupos de clínicas que comparten reuniones (Maxal, Elite...) en una entidad de DB gestionable desde la UI, reemplazando la config hardcodeada `SYNC_GROUPS` en código. El sync lee los grupos de la DB; un admin crea/edita grupos sin redeploy.

## Why
Hoy la agrupación vive en `src/domain/sync/groups.py` (config en código). Agregar/cambiar un grupo requiere editar código + rebuild. No hay `group_id` en la DB, los clientes no "saben" su grupo, y es frágil a errores de tipeo.

## Decisiones (brainstorming)
- **Modelo**: tabla `clinic_groups` (id, name) + FK `group_id` en `clients` (nullable, 1 sede→1 grupo).
- **UI**: CRUD completo en Configuración (crear/renombrar/borrar grupo, asignar/quitar sedes).
- **Cambios de grupo → regenerar**: al quitar sede o borrar grupo, se borran los duplicados (`_DD-`) y se re-sincroniza el grupo afectado (coherencia garantizada; originales intactos).
- **Label** del match_reason: se deriva del `name` del cliente.

## Scope
- IN: modelo + migración (siembra los 10 grupos actuales); `build_groups_from_db`; sync lee de DB; `group_admin` (CRUD + regenerar); endpoints; sección UI en Configuración.
- OUT: sede en múltiples grupos (N:N) — no hay caso real. Testing de frontend (diferido).

## Principios innegociables
- Los duplicados son datos DERIVADOS y regenerables; los originales NUNCA se tocan.
- El sync simétrico (Change anterior) se conserva igual; solo cambia su fuente (DB).
- Migración no destructiva.

## Affected modules
- Nuevo: tabla ClinicGroup + columna clients.group_id, migración, `src/services/group_admin.py`, endpoints, `lib/useGroups.ts`, sección en `dashboard/app/configuracion/page.tsx`, tests
- Modificado: `src/models.py`, `src/domain/sync/groups.py` (quita SYNC_GROUPS, conserva dataclass), `src/services/clinic_sync.py` (+ build_groups_from_db), `src/etl.py`

## Rollback plan
`git revert` + downgrade migración (drop column group_id, drop table). El sync vuelve a... (nota: requiere restaurar SYNC_GROUPS si se revierte). Backup antes en prod.

## Risks
- Regenerar mal podría borrar originales → mitigado: la limpieza filtra SOLO `_DD-` (duplicados), con test explícito.
- Migración: mapear los 10 grupos por client_id → seed verificado contra la config previa.
