# Tasks — Change 06: Frontend consume /clients/portfolio

## Fase 1: Tipos
- [x] 1.1 `PortfolioClient` + `ClientStatus` en lib/types.ts

## Fase 2: Página de Clientes (front "tonto")
- [x] 2.1 Consumir `/clients/portfolio?analyst_email=` (1 fetch en vez de 3)
- [x] 2.2 Borrar el cálculo de estado en el browser (useMemo de status)
- [x] 2.3 Filtro de analista → server-side (cambia la key de SWR)
- [x] 2.4 Búsqueda/estado/orden por fecha → solo presentación
- [x] 2.5 Banner de error si el backend falla (no tabla vacía)
- [x] 2.6 Historial del modal bajo demanda (`/appointments?matched_client_id=`), adiós limit=5000

## Fase 3: Verificación (sin tests de frontend, por decisión)
- [x] 3.1 `tsc --noEmit` limpio (exit 0)
- [x] 3.2 `eslint` limpio (exit 0)
- [x] 3.3 NO se ejecutó navegador (regla: no build) — verificación estática
- [x] 3.4 Commit

## Resultado
Página de Clientes consume el estado del backend (una sola verdad). Sin lógica de
negocio en el browser. Errores visibles. Historial bajo demanda (sin bulk 5000).
tsc + eslint verdes. Pendiente runtime: levantar el front cuando se quiera ver en vivo.
