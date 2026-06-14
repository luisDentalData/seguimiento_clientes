"""
Matcher — ADAPTADOR de infraestructura sobre el dominio de reuniones.

Responsabilidad: cargar datos desde la DB (clientes + mapa de emails, cacheados)
y delegar la decisión en `domain.meetings.classifier` (lógica pura). Mapea la
`ClassificationResult` del dominio al contrato legacy (match_status/confidence)
que consumen el ETL y la API hoy.

La taxonomía rica (VACACIONES/EVENTO/PERSONAL/SIN_CLASIFICAR) se calcula en el
dominio; el mapeo legacy las colapsa en NO_MATCH para no romper el esquema
actual. El cableado de la categoría a la tabla `appointments` se hace en Change 5.
"""
from sqlalchemy.orm import Session

from ..models import Client, ClientEmail
from ..domain.meetings.classifier import (
    ClientRecord,
    MeetingCategory,
    classify_meeting,
    normalize_text,
    word_match,
)


class Matcher:
    def __init__(self, db: Session):
        self.db = db
        self._clients_cache = None
        self._email_map_cache = None
        self._client_records_cache = None

    # ----------------------------------------------------------------- IO
    def _build_email_map(self):
        """Mapa email→client_id (una sola query por instancia, cacheada)."""
        if self._email_map_cache is None:
            mapping = {}
            for ce in self.db.query(ClientEmail).all():
                mapping[ce.email.lower()] = ce.client_id
            self._email_map_cache = mapping
        return self._email_map_cache

    def _get_clients(self):
        """Todos los clientes (una sola query por instancia, cacheada)."""
        if self._clients_cache is None:
            self._clients_cache = self.db.query(Client).all()
        return self._clients_cache

    def _client_records(self):
        """Proyecta los clientes ORM a value objects puros del dominio."""
        if self._client_records_cache is None:
            self._client_records_cache = [
                ClientRecord(
                    id=c.id,
                    name=c.name,
                    nombre_normalizado=c.nombre_normalizado,
                    nombres_alternativos=c.nombres_alternativos,
                    nombre_contacto=c.nombre_contacto,
                )
                for c in self._get_clients()
            ]
        return self._client_records_cache

    # ------------------------------------------------- helpers (compat tests)
    def _normalize_text(self, text):
        return normalize_text(text)

    def _word_match(self, search_term: str, text: str) -> bool:
        return word_match(search_term, text)

    # ----------------------------------------------------------- API legacy
    def match_appointment(self, appointment_data: dict) -> dict:
        """Clasifica y devuelve el contrato legacy.

        keys: match_status, matched_client_id, match_reason, match_confidence
        """
        attendees = appointment_data.get("attendees", []) or []
        summary = appointment_data.get("summary", "") or ""

        result = classify_meeting(
            summary=summary,
            attendees=attendees,
            clients=self._client_records(),
            email_map=self._build_email_map(),
        )
        return self._to_legacy(result)

    @staticmethod
    def _to_legacy(result) -> dict:
        """Mapea la categoría del dominio al match_status legacy."""
        if result.category is MeetingCategory.CLIENTE:
            status = "CONFIRMED" if result.confidence >= 0.90 else "PROBABLE"
            return {
                "match_status": status,
                "matched_client_id": result.matched_client_id,
                "match_reason": result.reason,
                "match_confidence": result.confidence,
            }
        if result.category is MeetingCategory.INTERNO:
            return {
                "match_status": "INTERNAL",
                "matched_client_id": None,
                "match_reason": result.reason,
                "match_confidence": 1.0,
            }
        # PERSONAL / VACACIONES / EVENTO / SIN_CLASIFICAR → NO_MATCH (legacy)
        return {
            "match_status": "NO_MATCH",
            "matched_client_id": None,
            "match_reason": result.reason,
            "match_confidence": 0.0,
        }
