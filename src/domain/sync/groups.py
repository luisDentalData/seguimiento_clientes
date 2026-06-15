"""
Configuración de grupos de clínicas que comparten reuniones.

Varias sedes del mismo grupo comparten las MISMAS reuniones. El sync replica
los appointments entre TODAS las sedes del grupo de forma SIMÉTRICA: no importa
a cuál sede el matcher haya asignado el evento — todas terminan con la unión de
las reuniones del grupo.

Antes era source→targets (una dirección), lo que fallaba si el matcher asignaba
el evento a un "target" en vez de al "source". Ahora todos los miembros son
equivalentes.

Cada miembro es (client_id, label). El label es un prefijo de trazabilidad que
se agrega al match_reason de los duplicados (ej. "[MAXAL GETXO] ...").
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class SyncGroup:
    name: str
    members: tuple  # tuple de (client_id, label)


# Grupos reales (10 grupos, 19+ sedes). Miembros simétricos.
SYNC_GROUPS: tuple = (
    SyncGroup("Amelar", (
        ("DD-00018", "AMELAR BELLAVISTA"),
        ("DD-00045", "AMELAR SEVILLA ESTE"),
    )),
    SyncGroup("Junyent", (
        ("DD-00078", "JUNYENT MANRESA"),
        ("DD-00089", "JUNYENT SMILE"),
    )),
    SyncGroup("Almidental", (
        ("DD-00008", "ALMIDENTAL PEDREGUER"),
        ("DD-00126", "ALMIDENTAL ONDARA"),
    )),
    SyncGroup("Smilodon", (
        ("DD-00112", "SMILODON GETAFE"),
        ("DD-00113", "SMILODON MADRID"),
    )),
    SyncGroup("Garantia", (
        ("DD-00080", "GARANTIA AYALA"),
        ("DD-00081", "GARANTIA QUINTANA"),
    )),
    SyncGroup("Maxal", (
        ("DD-00010", "MAXAL GETXO"),
        ("DD-00116", "MAXAL BILBAO"),
    )),
    SyncGroup("Triana", (
        ("DD-00014", "TRIANA 2"),
        ("DD-00015", "TRIANA 1"),
    )),
    SyncGroup("Rull", (
        ("DD-00128", "RULL ROTA"),
        ("DD-00129", "RULL SEVILLA"),
    )),
    SyncGroup("Elite", (
        ("DD-00070", "ELITE ALCALA I CANOVAS"),
        ("DD-00071", "ELITE LOPEZ FIGUEROA"),
        ("DD-00072", "ELITE ANTEQUERA"),
        ("DD-00073", "ELITE CASTELLANA"),
        ("DD-00074", "ELITE COSLADA"),
        ("DD-00075", "ELITE LAS ROZAS"),
        ("DD-00076", "ELITE LEGANES"),
    )),
    SyncGroup("Corral&Vargas", (
        ("DD-00145", "CORRAL VARGAS GRANADA NORTE"),
        ("DD-00146", "CORRAL VARGAS JAEN"),
        ("DD-00147", "CORRAL VARGAS GRANADA SUR"),
    )),
)
