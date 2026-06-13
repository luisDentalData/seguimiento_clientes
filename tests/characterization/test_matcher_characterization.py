"""
Tests de CARACTERIZACIÓN del Matcher (src/services/matching.py).

OBJETIVO: fijar el comportamiento ACTUAL antes de refactorizar (Change 3/5).
Estos tests NO juzgan si el comportamiento es correcto — lo CAPTURAN tal cual es.
Los quirks/bugs conocidos se marcan con "KNOWN RISK" para refactorizarlos
conscientemente más adelante, nunca para enshrinarlos en silencio.

Cada expectativa proviene de leer el código real, NO de inventar resultados.
"""
import pytest

pytestmark = pytest.mark.characterization


# ---------------------------------------------------------------------------
# 0. Eventos personales (prioridad más alta)
# ---------------------------------------------------------------------------

def test_personal_keyword_exacta_devuelve_no_match(matcher):
    result = matcher.match_appointment({"summary": "comida", "attendees": []})
    assert result["match_status"] == "NO_MATCH"
    assert result["match_confidence"] == pytest.approx(0.0)
    assert "personal" in result["match_reason"].lower()


def test_prefijo_recordatorio_devuelve_no_match(matcher):
    result = matcher.match_appointment({"summary": "Llamar a Juan", "attendees": []})
    assert result["match_status"] == "NO_MATCH"
    assert result["match_confidence"] == pytest.approx(0.0)


def test_vacaciones_colapsa_en_no_match_KNOWN_RISK(matcher):
    """KNOWN RISK / hueco de taxonomía: 'vacaciones' está en personal_keywords,
    así que hoy colapsa en NO_MATCH en vez de una categoría VACACIONES propia.
    Change 3 (taxonomía rica) resuelve esto. Acá solo lo fijamos."""
    result = matcher.match_appointment({"summary": "vacaciones", "attendees": []})
    assert result["match_status"] == "NO_MATCH"


def test_personal_tiene_precedencia_sobre_interno(matcher):
    """El check personal corre ANTES del interno: una reunión interna titulada
    con keyword personal devuelve NO_MATCH, no INTERNAL."""
    result = matcher.match_appointment(
        {"summary": "comida", "attendees": ["a@dentaldata.es", "b@dentaldata.es"]}
    )
    assert result["match_status"] == "NO_MATCH"


# ---------------------------------------------------------------------------
# 1. Reunión interna
# ---------------------------------------------------------------------------

def test_todos_dentaldata_devuelve_internal(matcher):
    result = matcher.match_appointment(
        {"summary": "Sprint planning", "attendees": ["a@dentaldata.es", "b@dentaldata.es"]}
    )
    assert result["match_status"] == "INTERNAL"
    assert result["match_confidence"] == pytest.approx(1.0)


def test_asistentes_mixtos_no_es_interno_y_sin_cliente_no_match(matcher):
    result = matcher.match_appointment(
        {"summary": "Reunion general", "attendees": ["a@dentaldata.es", "ext@gmail.com"]}
    )
    assert result["match_status"] == "NO_MATCH"


# ---------------------------------------------------------------------------
# 2. Match por email exacto
# ---------------------------------------------------------------------------

def test_email_exacto_case_insensitive_confirmed(matcher, client_factory):
    client_factory(
        id="CLI_T1",
        name="Clinica Sol",
        nombre_normalizado="clinica sol",
        emails=["contacto@clinicasol.com"],
    )
    result = matcher.match_appointment(
        {"summary": "Presupuesto anual", "attendees": ["Contacto@ClinicaSol.com"]}
    )
    assert result["match_status"] == "CONFIRMED"
    assert result["match_confidence"] == pytest.approx(1.0)
    assert result["matched_client_id"] == "CLI_T1"
    assert "email" in result["match_reason"].lower()


# ---------------------------------------------------------------------------
# 3. Match por nombre
# ---------------------------------------------------------------------------

def test_nombre_normalizado_palabra_completa_score_098(matcher, client_factory):
    client_factory(
        id="CLI_T2",
        name="Clinica Dental Sonrisa",
        nombre_normalizado="clinica dental sonrisa",
    )
    result = matcher.match_appointment(
        {"summary": "Reunion clinica dental sonrisa equipo", "attendees": ["x@gmail.com"]}
    )
    assert result["match_status"] == "CONFIRMED"
    assert result["match_confidence"] == pytest.approx(0.98)
    assert result["matched_client_id"] == "CLI_T2"


def test_nombre_alternativo_score_096(matcher, client_factory):
    client_factory(
        id="CLI_T3",
        name="Habinmet Clinica",
        nombre_normalizado="habinmet clinica",
        nombres_alternativos=["CD HABINMET12"],
    )
    result = matcher.match_appointment(
        {"summary": "Reunion CD HABINMET12 anual", "attendees": ["x@gmail.com"]}
    )
    assert result["match_status"] == "CONFIRMED"
    assert result["match_confidence"] == pytest.approx(0.96)
    assert result["matched_client_id"] == "CLI_T3"


def test_nombre_contacto_score_094(matcher, client_factory):
    client_factory(
        id="CLI_T4",
        name="Hondarribia Klinika",
        nombre_normalizado="hondarribia klinika",
        nombre_contacto="Ernesto Toledo",
    )
    result = matcher.match_appointment(
        {"summary": "Reunion Ernesto Toledo presupuesto", "attendees": ["x@gmail.com"]}
    )
    assert result["match_status"] == "CONFIRMED"
    assert result["match_confidence"] == pytest.approx(0.94)
    assert result["matched_client_id"] == "CLI_T4"


def test_match_base_dos_palabras_score_093_KNOWN_RISK(matcher, client_factory):
    """KNOWN RISK (A5): el matching toma las 2 primeras palabras del nombre con
    score 0.93. Esto puede generar falsos positivos entre clínicas que comparten
    base (ej. 'garantia dental ayala' vs 'garantia dental quintana').
    Se FIJA el comportamiento actual; se corrige conscientemente en Change 3/5."""
    client_factory(
        id="CLI_T5",
        name="Garantia Dental Ayala",
        nombre_normalizado="garantia dental ayala",
    )
    result = matcher.match_appointment(
        {"summary": "sesion garantia dental", "attendees": ["x@gmail.com"]}
    )
    assert result["match_status"] == "CONFIRMED"
    assert result["match_confidence"] == pytest.approx(0.93)
    assert result["matched_client_id"] == "CLI_T5"


def test_probable_es_inalcanzable_siempre_confirmed_KNOWN_RISK(matcher, client_factory):
    """KNOWN RISK: la banda PROBABLE (0.75–0.90) es código MUERTO hoy.
    Todos los matches por nombre dan score >= 0.92, por lo que el resultado
    siempre es CONFIRMED. El score más bajo posible (0.92) lo demuestra."""
    client_factory(
        id="CLI_T6",
        name="Lopez Figueroa Dental",
        nombre_normalizado=None,  # fuerza que solo matchee por el nombre principal (base)
    )
    result = matcher.match_appointment(
        {"summary": "reunion lopez figueroa", "attendees": ["x@gmail.com"]}
    )
    assert result["match_confidence"] == pytest.approx(0.92)
    assert result["match_status"] == "CONFIRMED"  # nunca PROBABLE


def test_guard_anti_substring_antia_no_matchea_garantia(matcher, client_factory):
    """Regresión del bug histórico: 'antia dental' NO debe matchear dentro de
    'garantia dental' (word boundary). Garantía de no-regresión."""
    client_factory(
        id="CLI_T7",
        name="Antia Dental",
        nombre_normalizado="antia dental",
    )
    result = matcher.match_appointment(
        {"summary": "Reunion garantia dental equipo", "attendees": ["x@gmail.com"]}
    )
    assert result["match_status"] == "NO_MATCH"


def test_sin_coincidencias_devuelve_no_match(matcher, client_factory):
    client_factory(id="CLI_T8", name="Clinica Sol", nombre_normalizado="clinica sol")
    result = matcher.match_appointment(
        {"summary": "Compra de material", "attendees": ["v@vendor.com"]}
    )
    assert result["match_status"] == "NO_MATCH"
    assert result["match_confidence"] == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# Helpers internos del Matcher (lógica pura)
# ---------------------------------------------------------------------------

def test_normalize_text_quita_acentos(matcher):
    assert matcher._normalize_text("Clínica Peña") == "clinica pena"


def test_word_match_no_matchea_substring(matcher):
    assert matcher._word_match("antia dental", "reunion garantia dental") is False


def test_word_match_si_matchea_palabra_completa(matcher):
    assert matcher._word_match("antia dental", "reunion antia dental hoy") is True
