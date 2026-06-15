# Tasks — Change 12: Grupos de sedes en DB

## Fase 1: Modelo + migración
- [x] 1.1 Modelo ClinicGroup (id, name) + columna clients.group_id (FK, nullable)
- [x] 1.2 Migración c3d4e5f6a7b8: tabla + columna + seed de los 10 grupos (set group_id)

## Fase 2: Sync desde DB
- [x] 2.1 `build_groups_from_db(db)` en clinic_sync (members = sedes por group_id, label = name)
- [x] 2.2 ETL usa build_groups_from_db en vez de SYNC_GROUPS
- [x] 2.3 Quitar SYNC_GROUPS de groups.py (conservado dataclass SyncGroup)

## Fase 3: group_admin (CRUD + regenerar)
- [x] 3.1 list/create/rename/delete_group
- [x] 3.2 assign_client / remove_client
- [x] 3.3 regenerate(group_id): borra dups (_DD-) de miembros + re-sync; limpieza al quitar/borrar

## Fase 4: API
- [x] 4.1 Schemas + endpoints GET/POST /groups, PUT/DELETE /groups/{id}, POST/DELETE /groups/{id}/members/{client_id}

## Fase 5: Frontend
- [x] 5.1 `lib/useGroups.ts`
- [x] 5.2 Sección "Grupos de sedes" en /configuracion (GroupsManager: CRUD + asignar/quitar)

## Fase 6: Tests + verificación
- [x] 6.1 Tests backend (6): CRUD, build_groups_from_db, sync desde DB, regenerar/limpieza, originales intactos
- [x] 6.2 Suite: 94 verde
- [x] 6.3 tsc + eslint . EXIT 0
- [x] 6.4 Migración aplicada a DB local (10 grupos sembrados)
- [x] 6.5 Commit

## Resultado
Grupos como entidad de DB gestionable desde la UI. Sync lee de la DB (build_groups_from_db).
group_admin con regenerar coherente. 94 tests verde. Migración aplicada.
PENDIENTE: rebuild contenedores para ver Change 12 en vivo (/groups + sección UI).
