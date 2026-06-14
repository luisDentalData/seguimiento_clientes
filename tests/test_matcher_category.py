"""
Tests de que el Matcher expone la categoría rica en el contrato legacy.
La categoría se persiste en appointments.category (Change 5).
"""
from src.domain.meetings.category import MeetingCategory


def test_match_appointment_incluye_category(matcher):
    result = matcher.match_appointment({"summary": "comida", "attendees": []})
    assert result["category"] == MeetingCategory.PERSONAL.value
    assert result["match_status"] == "NO_MATCH"  # legacy sin cambios


def test_vacaciones_category_pero_legacy_no_match(matcher):
    result = matcher.match_appointment({"summary": "vacaciones", "attendees": []})
    assert result["category"] == MeetingCategory.VACACIONES.value
    assert result["match_status"] == "NO_MATCH"


def test_interno_category(matcher):
    result = matcher.match_appointment(
        {"summary": "Sprint planning", "attendees": ["a@dentaldata.es", "b@dentaldata.es"]}
    )
    assert result["category"] == MeetingCategory.INTERNO.value
    assert result["match_status"] == "INTERNAL"


def test_cliente_category(matcher, client_factory):
    client_factory(id="CLI_C1", name="Clinica Sol", emails=["c@sol.com"])
    result = matcher.match_appointment(
        {"summary": "Presupuesto", "attendees": ["c@sol.com"]}
    )
    assert result["category"] == MeetingCategory.CLIENTE.value
    assert result["match_status"] == "CONFIRMED"
