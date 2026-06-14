"""
Clasificador de reuniones — LÓGICA PURA (sin DB, sin framework).

Recibe datos ya cargados (resumen, asistentes, clientes, mapa de emails) y
devuelve una `ClassificationResult` con la categoría de la reunión.

Precedencia (diseñada como REFINAMIENTO del comportamiento previo, para no
robarle casos a CLIENTE ni a INTERNO):
  1. PERSONAL    (keywords exactas / prefijos de recordatorio)
  2. VACACIONES  (keywords de ausencia/baja/festivo)
  3. INTERNO     (todos los asistentes @dentaldata.es)
  4. CLIENTE     (match por email exacto → confianza 1.0)
  5. CLIENTE     (match por nombre con límite de palabra → 0.92–0.98)
  6. EVENTO      (keywords de congreso/feria/formación; solo si no fue nada de lo anterior)
  7. SIN_CLASIFICAR

Los scores y la semántica de matching de cliente son IDÉNTICOS al Matcher
original (tests de caracterización lo verifican).
"""
import re
import unicodedata
from dataclasses import dataclass

from .category import MeetingCategory

# ---------------------------------------------------------------------------
# Keywords
# ---------------------------------------------------------------------------

# Personales (match EXACTO del título completo). 'vacaciones'/'festivo' se
# movieron a VACACIONES_KEYWORDS.
PERSONAL_KEYWORDS = {
    "casa", "comida", "almuerzo", "desayuno", "cena", "personal",
    "medico", "doctor", "dentista", "cita médica", "cita medica",
    "banco", "gestoría", "gestoria", "oficina", "gym", "gimnasio",
    "deporte", "peluquería", "peluqueria", "cumpleaños", "cumpleanos",
    "reunión familiar", "reunion familiar",
}

# Recordatorios/tareas (match por PREFIJO) → se consideran personales.
REMINDER_PREFIXES = (
    "llamar", "recordar", "recordatorio", "pendiente", "todo",
    "revisar", "enviar", "preparar", "planificar",
)

# Vacaciones/ausencias (match EXACTO del título completo).
VACACIONES_KEYWORDS = {
    "vacaciones", "festivo", "baja", "ausencia", "libranza",
    "dia libre", "día libre",
}

# Eventos profesionales (match por PALABRA dentro del título normalizado).
EVENTO_KEYWORDS = (
    "congreso", "feria", "formacion", "webinar", "evento",
    "conferencia", "jornada", "curso", "seminario",
)


# ---------------------------------------------------------------------------
# Value objects
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ClientRecord:
    """Datos mínimos de cliente necesarios para el matching (sin SQLAlchemy)."""

    id: str
    name: str | None = None
    nombre_normalizado: str | None = None
    nombres_alternativos: list | None = None
    nombre_contacto: str | None = None


@dataclass(frozen=True)
class ClassificationResult:
    category: MeetingCategory
    matched_client_id: str | None = None
    confidence: float = 0.0
    reason: str = ""


# ---------------------------------------------------------------------------
# Helpers de texto (puros)
# ---------------------------------------------------------------------------

def normalize_text(text: str | None) -> str:
    """Normaliza: minúsculas, sin acentos, sin signos, espacios colapsados."""
    if not text:
        return ""
    text = text.lower().strip()
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ASCII", "ignore").decode("ASCII")
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


def word_match(search_term: str, text: str) -> bool:
    """True si search_term aparece como palabra(s) COMPLETA(s) en text.

    Previene que 'antia dental' matchee dentro de 'garantia dental'.
    """
    if not search_term or not text:
        return False
    pattern = r"\b" + re.escape(search_term) + r"\b"
    return bool(re.search(pattern, text))


# ---------------------------------------------------------------------------
# Detectores de categoría
# ---------------------------------------------------------------------------

def _detect_personal_or_vacaciones(summary: str) -> MeetingCategory | None:
    """Replica la detección personal original, separando VACACIONES."""
    s = (summary or "").lower().strip()
    if not s:
        return None
    if s in PERSONAL_KEYWORDS:
        return MeetingCategory.PERSONAL
    if s in VACACIONES_KEYWORDS:
        return MeetingCategory.VACACIONES
    if any(s.startswith(k) for k in REMINDER_PREFIXES):
        return MeetingCategory.PERSONAL
    return None


def _is_internal(attendees: list) -> bool:
    """True si todos los asistentes válidos son @dentaldata.es."""
    if not attendees:
        return False
    valid = [a for a in attendees if a and isinstance(a, str)]
    if not valid:
        return False
    dentaldata = [a for a in valid if "@dentaldata.es" in a.lower()]
    return len(dentaldata) == len(valid)


def _match_email(attendees: list, clients: list, email_map: dict):
    """Match por email exacto. Devuelve ClassificationResult o None."""
    names = {c.id: c.name for c in clients}
    for email in attendees:
        if not email:
            continue
        email_lower = email.lower().strip()
        if email_lower in email_map:
            client_id = email_map[email_lower]
            client_name = names.get(client_id) or "Cliente"
            return ClassificationResult(
                category=MeetingCategory.CLIENTE,
                matched_client_id=client_id,
                confidence=1.0,
                reason=f"Email exacto: {email} → {client_name}",
            )
    return None


def _match_name(summary_normalized: str, clients: list):
    """Match por nombre (límite de palabra). Misma lógica/score que el original.

    Devuelve (best_client_id, best_score, best_reason) o (None, 0, "").
    """
    best_id = None
    best_score = 0.0
    best_reason = ""

    for client in clients:
        if client.nombre_normalizado:
            norm_client_name = normalize_text(client.nombre_normalizado)
            if norm_client_name and word_match(norm_client_name, summary_normalized):
                score = 0.98
                if score > best_score:
                    best_score, best_id = score, client.id
                    best_reason = f"Nombre normalizado en título: '{client.nombre_normalizado}'"
                    continue

            name_words = norm_client_name.split()
            if len(name_words) >= 2:
                base_name = " ".join(name_words[:2])
                if base_name and word_match(base_name, summary_normalized):
                    score = 0.93
                    if score > best_score:
                        best_score, best_id = score, client.id
                        best_reason = f"Nombre base en título: '{base_name}' de '{client.nombre_normalizado}'"
                        continue

        if client.name:
            norm_main_name = normalize_text(client.name)
            if norm_main_name and word_match(norm_main_name, summary_normalized):
                score = 0.97
                if score > best_score:
                    best_score, best_id = score, client.id
                    best_reason = f"Nombre principal en título: '{client.name}'"
                    continue

            name_words = norm_main_name.split()
            if len(name_words) >= 2:
                base_name = " ".join(name_words[:2])
                if base_name and word_match(base_name, summary_normalized):
                    score = 0.92
                    if score > best_score:
                        best_score, best_id = score, client.id
                        best_reason = f"Nombre base en título: '{base_name}' de '{client.name}'"
                        continue

        if client.nombres_alternativos and isinstance(client.nombres_alternativos, list):
            for alt_name in client.nombres_alternativos:
                if alt_name:
                    norm_alt_name = normalize_text(alt_name)
                    if norm_alt_name and word_match(norm_alt_name, summary_normalized):
                        score = 0.96
                        if score > best_score:
                            best_score, best_id = score, client.id
                            best_reason = f"Nombre alternativo en título: '{alt_name}'"
                            break

        if client.nombre_contacto:
            norm_contact = normalize_text(client.nombre_contacto)
            if norm_contact and word_match(norm_contact, summary_normalized):
                score = 0.94
                if score > best_score:
                    best_score, best_id = score, client.id
                    best_reason = f"Nombre de contacto en título: '{client.nombre_contacto}'"
                    continue

    return best_id, best_score, best_reason


def _detect_evento(summary_normalized: str) -> bool:
    return any(word_match(k, summary_normalized) for k in EVENTO_KEYWORDS)


# ---------------------------------------------------------------------------
# Punto de entrada
# ---------------------------------------------------------------------------

def classify_meeting(
    summary: str,
    attendees: list,
    clients: list,
    email_map: dict,
) -> ClassificationResult:
    """Clasifica una reunión en una de las 6 categorías (lógica pura)."""
    attendees = attendees or []
    summary = summary or ""
    summary_normalized = normalize_text(summary)

    # 1-2. Personal / Vacaciones
    personal_cat = _detect_personal_or_vacaciones(summary)
    if personal_cat is MeetingCategory.PERSONAL:
        return ClassificationResult(
            category=MeetingCategory.PERSONAL,
            reason=f"Evento personal detectado: '{summary.lower().strip()}'",
        )
    if personal_cat is MeetingCategory.VACACIONES:
        return ClassificationResult(
            category=MeetingCategory.VACACIONES,
            reason=f"Vacaciones/ausencia detectada: '{summary.lower().strip()}'",
        )

    # 3. Interno
    if _is_internal(attendees):
        return ClassificationResult(
            category=MeetingCategory.INTERNO,
            confidence=1.0,
            reason="Reunion interna (solo asistentes @dentaldata.es)",
        )

    # 4. Cliente por email
    email_result = _match_email(attendees, clients, email_map)
    if email_result is not None:
        return email_result

    # 5. Cliente por nombre
    best_id, best_score, best_reason = _match_name(summary_normalized, clients)
    if best_id and best_score >= 0.75:
        return ClassificationResult(
            category=MeetingCategory.CLIENTE,
            matched_client_id=best_id,
            confidence=best_score,
            reason=best_reason,
        )

    # 6. Evento
    if _detect_evento(summary_normalized):
        return ClassificationResult(
            category=MeetingCategory.EVENTO,
            reason=f"Evento profesional detectado: '{summary.lower().strip()}'",
        )

    # 7. Sin clasificar
    return ClassificationResult(
        category=MeetingCategory.SIN_CLASIFICAR,
        reason=f"Sin coincidencias para '{summary}'",
    )
