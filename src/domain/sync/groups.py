"""
Configuración de grupos de clínicas sincronizadas.

Varias clínicas comparten las MISMAS reuniones (mismo grupo empresarial).
El ETL duplica los appointments de la clínica "fuente" hacia las "destino".

Antes esto eran ~10 bloques copy-paste de ~50 líneas cada uno en etl.py.
Ahora es ESTA tabla de configuración + un único loop (services/clinic_sync.py).
Agregar una clínica nueva = agregar una línea acá, no copiar 50.
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class SyncTarget:
    client_id: str
    label: str  # prefijo de trazabilidad en match_reason (ej. "ELITE CASTELLANA")


@dataclass(frozen=True)
class SyncGroup:
    source_id: str
    targets: tuple[SyncTarget, ...]
    # Para grupos bidireccionales (ej. Triana): también se sincroniza
    # target -> source, usando source_label como etiqueta de la fuente.
    bidirectional: bool = False
    source_label: str | None = None


# Grupos reales (extraídos verbatim de etl.py — 10 grupos, 17+ clínicas).
SYNC_GROUPS: tuple[SyncGroup, ...] = (
    SyncGroup("DD-00018", (SyncTarget("DD-00045", "AMELAR SEVILLA ESTE"),)),
    SyncGroup("DD-00078", (SyncTarget("DD-00089", "JUNYENT SMILE"),)),
    SyncGroup("DD-00008", (SyncTarget("DD-00126", "ALMIDENTAL ONDARA"),)),
    SyncGroup("DD-00112", (SyncTarget("DD-00113", "SMILODON MADRID"),)),
    SyncGroup("DD-00080", (SyncTarget("DD-00081", "GARANTIA QUINTANA"),)),
    SyncGroup("DD-00010", (SyncTarget("DD-00116", "MAXAL BILBAO"),)),
    SyncGroup(
        "DD-00014",
        (SyncTarget("DD-00015", "TRIANA 1"),),
        bidirectional=True,
        source_label="TRIANA 2",
    ),
    SyncGroup("DD-00128", (SyncTarget("DD-00129", "RULL SEVILLA"),)),
    SyncGroup(
        "DD-00070",
        (
            SyncTarget("DD-00071", "ELITE LOPEZ FIGUEROA"),
            SyncTarget("DD-00072", "ELITE ANTEQUERA"),
            SyncTarget("DD-00073", "ELITE CASTELLANA"),
            SyncTarget("DD-00074", "ELITE COSLADA"),
            SyncTarget("DD-00075", "ELITE LAS ROZAS"),
            SyncTarget("DD-00076", "ELITE LEGANES"),
        ),
    ),
    SyncGroup(
        "DD-00145",
        (
            SyncTarget("DD-00146", "CORRAL VARGAS JAEN"),
            SyncTarget("DD-00147", "CORRAL VARGAS GRANADA SUR"),
        ),
    ),
)
