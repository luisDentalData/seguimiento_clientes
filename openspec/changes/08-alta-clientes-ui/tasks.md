# Tasks — Change 08: Alta/edición de clientes desde la UI

## Fase 1: Helper compartido de emails (DRY)
- [x] 1.1 `set_client_emails(db, client_id, emails, reassign)` en client_admin.py
- [x] 1.2 Refactor sync_clientes_maestro.py para usarlo (reassign=True) — tests de sync siguen verdes

## Fase 2: Servicio client_admin
- [x] 2.1 `next_client_id(db)` (DD-XXXXX, max+1)
- [x] 2.2 `create_client(db, data)` (autogenera id, deriva normalizado, emails reject duplicados)
- [x] 2.3 `update_client(db, id, data)`
- [x] 2.4 `deactivate_client(db, id)` (soft, preserva appointments)
- [x] 2.5 Excepciones: ClientAdminError / DuplicateEmailError / ClientNotFoundError

## Fase 3: API
- [x] 3.1 Schemas ClientAdminCreate / ClientAdminUpdate
- [x] 3.2 POST /clients, PUT /clients/{id}, POST /clients/{id}/deactivate, GET /clients/{id}
- [x] 3.3 Mapear excepciones a HTTP 400/404/409
- [x] 3.4 Orden de rutas: estáticas /clients/* ANTES de /clients/{id} (verificado)

## Fase 4: Frontend
- [x] 4.1 `ClientFormModal.tsx` (form crear/editar con emails dinámicos)
- [x] 4.2 Botón "+ Nuevo cliente" + editar + desactivar por fila
- [x] 4.3 POST/PUT → refresca portfolio (mutate) + aviso "dale a Sync"
- [x] 4.4 Errores de validación visibles

## Fase 5: Verificación
- [x] 5.1 Tests backend (Postgres real): next_id, create, validación, dup email, update, deactivate (9)
- [x] 5.2 Tests de sync siguen verdes (refactor del helper)
- [x] 5.3 Suite completa: 75 verde
- [x] 5.4 tsc + eslint del frontend limpios
- [x] 5.5 Commit

## Resultado
Alta/edición/desactivación de clientes desde la UI. DB como fuente de verdad.
Helper de emails compartido (DRY) con el sync masivo. 9 tests nuevos (75 total).
Verificación frontend: tsc + eslint (sin tests de front por decisión). NO se hizo
smoke HTTP en vivo (el contenedor corre código viejo; regla no-build).
