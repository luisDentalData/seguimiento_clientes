
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

# Client Schemas
class ClientBase(BaseModel):
    name: str
    nombre_normalizado: Optional[str] = None
    nombres_alternativos: Optional[List[str]] = []
    nombre_contacto: Optional[str] = None
    telefono: Optional[str] = None
    movil: Optional[str] = None
    direccion: Optional[str] = None
    poblacion: Optional[str] = None
    provincia: Optional[str] = None
    nif_cif: Optional[str] = None
    programa: Optional[str] = None  # Software de gestión
    fuentes: Optional[List[str]] = []
    status: str = "active"

class ClientCreate(ClientBase):
    pass

# Schemas para administración desde la UI (Change 08)
class ClientAdminCreate(BaseModel):
    name: str
    nombre_contacto: Optional[str] = None
    telefono: Optional[str] = None
    movil: Optional[str] = None
    direccion: Optional[str] = None
    poblacion: Optional[str] = None
    provincia: Optional[str] = None
    nif_cif: Optional[str] = None
    programa: Optional[str] = None
    nombres_alternativos: List[str] = []
    emails: List[str] = []

class ClientAdminUpdate(BaseModel):
    name: Optional[str] = None
    nombre_contacto: Optional[str] = None
    telefono: Optional[str] = None
    movil: Optional[str] = None
    direccion: Optional[str] = None
    poblacion: Optional[str] = None
    provincia: Optional[str] = None
    nif_cif: Optional[str] = None
    programa: Optional[str] = None
    nombres_alternativos: Optional[List[str]] = None
    emails: Optional[List[str]] = None

class Client(ClientBase):
    id: str  # Changed from int to str (format: CLI_XXXXX)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Appointment Schemas
class AppointmentBase(BaseModel):
    id: str # Google Event ID
    analyst_email: str
    summary: str
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    attendees: List[str] = []
    
    is_client_meeting: bool = False
    match_status: str
    match_confidence: float = 0.0
    match_reason: Optional[str] = None
    matched_client_id: Optional[str] = None  # Changed from int to str

class Appointment(AppointmentBase):
    matched_client: Optional[Client] = None

    class Config:
        from_attributes = True
