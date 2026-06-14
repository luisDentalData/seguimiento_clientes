"""Tests de la regla de estado del cliente (dominio puro)."""
import pytest

from src.domain.clients.status import ClientStatus, classify_client_status


@pytest.mark.parametrize(
    "days,expected",
    [
        (0, ClientStatus.OK),
        (15, ClientStatus.OK),
        (30, ClientStatus.OK),          # límite OK
        (31, ClientStatus.ATTENTION),   # primer día de ATENCIÓN
        (45, ClientStatus.ATTENTION),
        (60, ClientStatus.ATTENTION),   # límite ATENCIÓN
        (61, ClientStatus.CRITICAL),    # primer día de CRÍTICO
        (365, ClientStatus.CRITICAL),
    ],
)
def test_status_por_dias(days, expected):
    assert classify_client_status(days) is expected


def test_sin_sesiones_es_critical():
    assert classify_client_status(None) is ClientStatus.CRITICAL
