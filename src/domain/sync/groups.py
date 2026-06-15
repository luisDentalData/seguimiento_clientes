"""
Estructura en runtime de un grupo de sedes que comparten reuniones.

Los grupos YA NO se definen acá (eran hardcodeados). Ahora viven en la DB
(tabla clinic_groups + clients.group_id) y se arman en runtime con
`clinic_sync.build_groups_from_db()`. Este dataclass es solo el contenedor
que consume el sync simétrico.

Cada miembro es (client_id, label). El label (nombre del cliente) se usa como
prefijo de trazabilidad en el match_reason de los duplicados.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class SyncGroup:
    name: str
    members: tuple  # tuple de (client_id, label)
