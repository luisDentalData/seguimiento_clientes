# Tasks — Change 10: Carga por categoría

## Fase 1: Backend
- [x] 1.1 `src/services/category_stats.py` — get_category_stats (total/by_analyst/by_month)
- [x] 1.2 NULL→SIN_CLASIFICAR; by_month agrega en Python (evita GROUP BY con to_char)
- [x] 1.3 Endpoint `GET /stats/categories?analyst_email=&month=`
- [x] 1.4 6 tests (total, filtros mes/analista, by_analyst, by_month ignora mes/respeta analista)

## Fase 2: Frontend (sección en Analíticas)
- [x] 2.1 Tipo CategoryStats en lib/types.ts
- [x] 2.2 Fetch /stats/categories con filtros del FilterBar
- [x] 2.3 Gráfico torta (distribución total)
- [x] 2.4 Barras apiladas por analista
- [x] 2.5 Barras apiladas por mes
- [x] 2.6 Aviso si todo SIN_CLASIFICAR (pre-ETL)

## Fase 3: Verificación
- [x] 3.1 Suite backend: 81 verde
- [x] 3.2 tsc + eslint . (proyecto entero) EXIT 0
- [x] 3.3 Endpoint registrado; sanity DB real
- [ ] 3.4 ⚠️ Verificación visual de gráficos — PENDIENTE del usuario
- [x] 3.5 Commit

## Resultado
Vista de carga por categoría operativa (total/analista/mes). Cierra el objetivo de
analizar la carga del equipo por tipo de reunión. Datos reales tras re-correr el ETL.
