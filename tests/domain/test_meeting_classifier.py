"""
Tests del clasificador de reuniones (dominio puro — sin DB).
Verifican la TAXONOMÍA RICA nueva y la precedencia entre categorías.
"""
from src.domain.meetings.category import MeetingCategory
from src.domain.meetings.classifier import ClientRecord, classify_meeting


def _classify(summary, attendees=None, clients=None, email_map=None):
    return classify_meeting(
        summary=summary,
        attendees=attendees or [],
        clients=clients or [],
        email_map=email_map or {},
    )


def test_comida_es_personal():
    assert _classify("comida").category is MeetingCategory.PERSONAL


def test_vacaciones_es_categoria_propia():
    """La mejora central: 'vacaciones' ya NO colapsa en un cajón ciego."""
    assert _classify("vacaciones").category is MeetingCategory.VACACIONES


def test_baja_es_vacaciones():
    assert _classify("baja").category is MeetingCategory.VACACIONES


def test_congreso_externo_es_evento():
    result = _classify("Congreso dental Madrid", attendees=["ext@gmail.com"])
    assert result.category is MeetingCategory.EVENTO


def test_todos_dentaldata_es_interno():
    result = _classify("Sprint planning", attendees=["a@dentaldata.es", "b@dentaldata.es"])
    assert result.category is MeetingCategory.INTERNO


def test_personal_tiene_precedencia_sobre_interno():
    result = _classify("comida", attendees=["a@dentaldata.es"])
    assert result.category is MeetingCategory.PERSONAL


def test_interno_tiene_precedencia_sobre_evento():
    """Una formación INTERNA (todos @dentaldata.es) es INTERNO, no EVENTO:
    el evento no le roba casos al trabajo interno."""
    result = _classify("Formacion equipo", attendees=["a@dentaldata.es", "b@dentaldata.es"])
    assert result.category is MeetingCategory.INTERNO


def test_cliente_por_email():
    result = _classify(
        "Presupuesto anual",
        attendees=["Contacto@ClinicaSol.com"],
        clients=[ClientRecord(id="CLI_1", name="Clinica Sol")],
        email_map={"contacto@clinicasol.com": "CLI_1"},
    )
    assert result.category is MeetingCategory.CLIENTE
    assert result.matched_client_id == "CLI_1"
    assert result.confidence == 1.0


def test_cliente_por_nombre():
    result = _classify(
        "Reunion clinica dental sonrisa",
        attendees=["x@gmail.com"],
        clients=[ClientRecord(id="CLI_2", name="Clinica Dental Sonrisa",
                              nombre_normalizado="clinica dental sonrisa")],
    )
    assert result.category is MeetingCategory.CLIENTE
    assert result.matched_client_id == "CLI_2"
    assert result.confidence == 0.98


def test_sin_coincidencias_es_sin_clasificar():
    result = _classify("Compra de material", attendees=["v@vendor.com"])
    assert result.category is MeetingCategory.SIN_CLASIFICAR


def test_cliente_tiene_precedencia_sobre_evento():
    """Si una reunión menciona un cliente Y una keyword de evento,
    gana CLIENTE (el matching de cliente corre antes que evento)."""
    result = _classify(
        "Congreso con clinica dental sonrisa",
        attendees=["x@gmail.com"],
        clients=[ClientRecord(id="CLI_3", name="Clinica Dental Sonrisa",
                              nombre_normalizado="clinica dental sonrisa")],
    )
    assert result.category is MeetingCategory.CLIENTE
