
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..models import Client, ClientEmail, Appointment
import re

class Matcher:
    def __init__(self, db: Session):
        self.db = db
        # Cache para la instancia actual (se reutiliza durante toda la ejecución del ETL)
        self._clients_cache = None
        self._email_map_cache = None

    def _build_email_map(self):
        """
        Map all known emails to client IDs with instance-level caching.

        CACHING STRATEGY:
        - Cache persists for the lifetime of this Matcher instance
        - During ETL: Single Matcher instance processes all events → 1 DB query total
        - After ETL: New Matcher instance created → Fresh data from DB
        - No manual restart needed: New clients visible on next ETL run

        Performance:
        - WITHOUT cache: 3,176 queries per ETL = ~5-10 minutes
        - WITH cache: 1 query per ETL = ~30-60 seconds
        """
        if self._email_map_cache is None:
            mapping = {}
            client_emails = self.db.query(ClientEmail).all()
            for ce in client_emails:
                mapping[ce.email.lower()] = ce.client_id
            self._email_map_cache = mapping
        return self._email_map_cache

    def _get_clients(self):
        """
        Get all clients from database with instance-level caching.

        CACHING STRATEGY:
        - Cache persists for the lifetime of this Matcher instance
        - During ETL: Single Matcher instance processes all events → 1 DB query total
        - After ETL: New Matcher instance created → Fresh data from DB
        - No manual restart needed: New clients visible on next ETL run

        Performance:
        - WITHOUT cache: 3,176 queries per ETL = ~5-10 minutes
        - WITH cache: 1 query per ETL = ~30-60 seconds
        """
        if self._clients_cache is None:
            self._clients_cache = self.db.query(Client).all()
        return self._clients_cache

    def _normalize_text(self, text):
        """Normalize text for better matching"""
        if not text:
            return ""
        # Convert to lowercase
        text = text.lower().strip()

        # Remove accents/diacritics
        import unicodedata
        text = unicodedata.normalize('NFKD', text)
        text = text.encode('ASCII', 'ignore').decode('ASCII')

        # Remove special characters but keep spaces
        text = re.sub(r'[^\w\s]', ' ', text)
        # Normalize spaces
        text = re.sub(r'\s+', ' ', text)
        return text

    def _word_match(self, search_term: str, text: str) -> bool:
        """
        Check if search_term appears as whole words in text.
        This prevents "antia dental" from matching "garantia dental".

        Args:
            search_term: Normalized search term (e.g., "antia dental")
            text: Normalized text to search in (e.g., "sesion garantia dental equipo")

        Returns:
            True if all words in search_term appear as complete words in text
        """
        if not search_term or not text:
            return False

        # Use word boundaries to match complete words only
        # \b ensures we match whole words, not substrings
        pattern = r'\b' + re.escape(search_term) + r'\b'
        return bool(re.search(pattern, text))

    def _is_internal_meeting(self, attendees: list) -> bool:
        """
        Check if a meeting is internal (all attendees are from dentaldata.es).

        Args:
            attendees: List of email addresses

        Returns:
            True if all attendees are @dentaldata.es, False otherwise
        """
        if not attendees or len(attendees) == 0:
            return False

        # Filter out empty emails
        valid_attendees = [a for a in attendees if a and isinstance(a, str)]
        if not valid_attendees:
            return False

        # Check if all attendees are from dentaldata.es
        dentaldata_emails = [a for a in valid_attendees if '@dentaldata.es' in a.lower()]

        return len(dentaldata_emails) == len(valid_attendees)

    def _is_personal_event(self, summary: str) -> bool:
        """
        Check if an event is personal/non-client by matching keywords.

        Args:
            summary: Event title/summary

        Returns:
            True if it's a personal event, False otherwise
        """
        if not summary:
            return False

        summary_lower = summary.lower().strip()

        # Personal/non-client keywords (exact match)
        personal_keywords = [
            'casa', 'comida', 'almuerzo', 'desayuno', 'cena', 'personal',
            'medico', 'doctor', 'dentista', 'cita médica', 'cita medica',
            'vacaciones', 'festivo', 'banco', 'gestoría', 'gestoria',
            'oficina', 'gym', 'gimnasio', 'deporte', 'peluquería', 'peluqueria',
            'cumpleaños', 'cumpleanos', 'reunión familiar', 'reunion familiar'
        ]

        # Reminder/task keywords (starts with)
        reminder_keywords = [
            'llamar', 'recordar', 'recordatorio', 'pendiente', 'todo',
            'revisar', 'enviar', 'preparar', 'planificar'
        ]

        # Check exact match (full summary is just the keyword)
        if summary_lower in personal_keywords:
            return True

        # Check if starts with reminder keywords
        for keyword in reminder_keywords:
            if summary_lower.startswith(keyword):
                return True

        return False

    def match_appointment(self, appointment_data: dict) -> dict:
        """
        Determines if an appointment matches a client using a multi-tier matching strategy:
        0. Personal event detection (NO_MATCH, confidence: 1.0)
        1. Internal meeting detection (INTERNAL, confidence: 1.0)
        2. Email exact match (CONFIRMED, confidence: 1.0)
        3. Exact name match in summary (CONFIRMED, confidence: 0.98)
        4. Alternative names exact match (CONFIRMED, confidence: 0.96)
        5. Fuzzy name matching with high threshold (PROBABLE, confidence: 0.85-0.95)
        6. Fuzzy alternative names (PROBABLE, confidence: 0.80-0.90)

        Returns dict with keys: match_status, matched_client_id, match_reason, match_confidence
        """
        attendees = appointment_data.get('attendees', [])
        summary = appointment_data.get('summary', '')
        summary_normalized = self._normalize_text(summary)

        # 0. PERSONAL EVENT CHECK (Highest priority after internal)
        if self._is_personal_event(summary):
            return {
                "match_status": "NO_MATCH",
                "matched_client_id": None,
                "match_reason": f"Evento personal detectado: '{summary.lower().strip()}'",
                "match_confidence": 0.0
            }

        # 1. INTERNAL MEETING CHECK
        if self._is_internal_meeting(attendees):
            return {
                "match_status": "INTERNAL",
                "matched_client_id": None,
                "match_reason": "Reunion interna (solo asistentes @dentaldata.es)",
                "match_confidence": 1.0
            }

        # 2. EMAIL EXACT MATCH
        email_map = self._build_email_map()

        for email in attendees:
            if not email:
                continue
            email_lower = email.lower().strip()
            if email_lower in email_map:
                client_id = email_map[email_lower]
                client = self.db.query(Client).filter(Client.id == client_id).first()
                return {
                    "match_status": "CONFIRMED",
                    "matched_client_id": client_id,
                    "match_reason": f"Email exacto: {email} → {client.name if client else 'Cliente'}",
                    "match_confidence": 1.0
                }

        # 3. NAME MATCHING (Using normalized names and alternatives)
        clients = self._get_clients()
        best_match = None
        best_score = 0
        best_reason = ""

        for client in clients:
            # Check normalized name (whole word match)
            if client.nombre_normalizado:
                norm_client_name = self._normalize_text(client.nombre_normalizado)
                if norm_client_name and self._word_match(norm_client_name, summary_normalized):
                    score = 0.98
                    if score > best_score:
                        best_score = score
                        best_match = client
                        best_reason = f"Nombre normalizado en título: '{client.nombre_normalizado}'"
                        continue

                # Also check partial match for multi-word names (e.g., "garantia dental" matches "garantia dental ayala")
                # Extract the first 2-3 significant words (excluding común words like "clinica", "dental")
                name_words = norm_client_name.split()
                if len(name_words) >= 2:
                    # Try first 2 words as a base name (e.g., "garantia dental" from "garantia dental ayala")
                    base_name = ' '.join(name_words[:2])
                    if base_name and self._word_match(base_name, summary_normalized):
                        score = 0.93  # Slightly lower confidence than exact match
                        if score > best_score:
                            best_score = score
                            best_match = client
                            best_reason = f"Nombre base en título: '{base_name}' de '{client.nombre_normalizado}'"
                            continue

            # Check main name (whole word match)
            if client.name:
                norm_main_name = self._normalize_text(client.name)
                if norm_main_name and self._word_match(norm_main_name, summary_normalized):
                    score = 0.97
                    if score > best_score:
                        best_score = score
                        best_match = client
                        best_reason = f"Nombre principal en título: '{client.name}'"
                        continue

                # Partial match for main name too
                name_words = norm_main_name.split()
                if len(name_words) >= 2:
                    base_name = ' '.join(name_words[:2])
                    if base_name and self._word_match(base_name, summary_normalized):
                        score = 0.92
                        if score > best_score:
                            best_score = score
                            best_match = client
                            best_reason = f"Nombre base en título: '{base_name}' de '{client.name}'"
                            continue

            # Check alternative names (whole word match)
            if client.nombres_alternativos and isinstance(client.nombres_alternativos, list):
                for alt_name in client.nombres_alternativos:
                    if alt_name:
                        norm_alt_name = self._normalize_text(alt_name)
                        if norm_alt_name and self._word_match(norm_alt_name, summary_normalized):
                            score = 0.96
                            if score > best_score:
                                best_score = score
                                best_match = client
                                best_reason = f"Nombre alternativo en título: '{alt_name}'"
                                break

            # Check contact name (whole word match)
            if client.nombre_contacto:
                norm_contact = self._normalize_text(client.nombre_contacto)
                if norm_contact and self._word_match(norm_contact, summary_normalized):
                    score = 0.94
                    if score > best_score:
                        best_score = score
                        best_match = client
                        best_reason = f"Nombre de contacto en título: '{client.nombre_contacto}'"
                        continue

            # 4. FUZZY MATCHING - DISABLED
            # Fuzzy matching has been disabled because it causes too many false positives
            # (e.g., "garantia" matching with "antia")
            # Only exact substring matches are allowed above
            pass

        # Return best match if above threshold
        if best_match and best_score >= 0.90:
            return {
                "match_status": "CONFIRMED",
                "matched_client_id": best_match.id,
                "match_reason": best_reason,
                "match_confidence": best_score
            }
        elif best_match and best_score >= 0.75:
            return {
                "match_status": "PROBABLE",
                "matched_client_id": best_match.id,
                "match_reason": best_reason,
                "match_confidence": best_score
            }

        # No match found
        return {
            "match_status": "NO_MATCH",
            "matched_client_id": None,
            "match_reason": f"Sin coincidencias para '{summary}'",
            "match_confidence": 0.0
        }
