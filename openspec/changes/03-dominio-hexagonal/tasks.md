# Tasks — Change 03: Dominio hexagonal + taxonomía rica

## Fase 1: Dominio de reuniones
- [x] 1.1 `src/domain/meetings/category.py` — enum MeetingCategory (6 categorías)
- [x] 1.2 `src/domain/meetings/classifier.py` — clasificador puro (ClientRecord, classify_meeting, helpers normalize/word_match)
- [x] 1.3 Precedencia conservadora (personal→vacaciones→interno→cliente→evento→sin_clasificar)

## Fase 2: Dominio de clientes
- [x] 2.1 `src/domain/clients/status.py` — ClientStatus + classify_client_status

## Fase 3: Refactor del Matcher (behavior-preserving)
- [x] 3.1 Matcher delega en classify_meeting; mapea a contrato legacy
- [x] 3.2 Eliminado N+1 de la query por email (nombre resuelto desde memoria)
- [x] 3.3 Helpers _normalize_text/_word_match como wrappers del dominio

## Fase 4: Verificación
- [x] 4.1 17 tests de caracterización VERDES sin modificarlos (red de seguridad)
- [x] 4.2 Tests de dominio nuevos: taxonomía (11) + estado (9)
- [x] 4.3 Sanity de imports (ETL no se rompe)
- [x] 4.4 Suite completa: 46 verde
- [x] 4.5 Commit

## Resultado
Capa domain/ pura creada. Matcher refactorizado a adaptador SIN cambiar su contrato
(17 caracterización verdes). Taxonomía rica disponible en el dominio (se cablea a
appointments en Change 5). N+1 de email eliminado de paso. 46 tests verde.
Decisión: rename src→backend DIFERIDO (cosmético, alto churn).
