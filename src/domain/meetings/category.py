"""Taxonomía de categorías de reuniones.

Reemplaza el modelo binario anterior (CLIENTE / INTERNO / NO_MATCH) por una
taxonomía rica que permite analizar la carga del equipo por tipo de reunión.
"""
from enum import Enum


class MeetingCategory(str, Enum):
    """Categorías posibles de una reunión de calendario."""

    CLIENTE = "CLIENTE"            # reunión con un cliente (email o nombre)
    INTERNO = "INTERNO"           # trabajo interno del equipo (@dentaldata.es)
    VACACIONES = "VACACIONES"     # ausencias, bajas, festivos, días libres
    EVENTO = "EVENTO"             # congresos, ferias, formaciones, webinars
    PERSONAL = "PERSONAL"         # casa, comida, médico (no laboral)
    SIN_CLASIFICAR = "SIN_CLASIFICAR"  # no encajó en ninguna (revisión manual)
