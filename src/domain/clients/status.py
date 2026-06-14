"""
Regla de estado del cliente — LÓGICA PURA.

Clasifica la salud del cliente según los días transcurridos desde su última
sesión válida (CONFIRMED/PROBABLE). Esta regla vivía en el navegador
(dashboard) y se trae al backend para que sea una ÚNICA verdad para todos.

Umbrales (calculados SIEMPRE desde HOY):
  - OK:        última sesión válida hace <= 30 días
  - ATTENTION: entre 31 y 60 días
  - CRITICAL:  > 60 días, o sin ninguna sesión válida
"""
from enum import Enum

OK_MAX_DAYS = 30
ATTENTION_MAX_DAYS = 60


class ClientStatus(str, Enum):
    OK = "OK"
    ATTENTION = "ATTENTION"
    CRITICAL = "CRITICAL"


def classify_client_status(days_since_last_valid_session: int | None) -> ClientStatus:
    """Devuelve el estado del cliente a partir de los días sin sesión válida.

    `None` (nunca tuvo sesión válida) => CRITICAL.
    """
    if days_since_last_valid_session is None:
        return ClientStatus.CRITICAL
    if days_since_last_valid_session <= OK_MAX_DAYS:
        return ClientStatus.OK
    if days_since_last_valid_session <= ATTENTION_MAX_DAYS:
        return ClientStatus.ATTENTION
    return ClientStatus.CRITICAL
