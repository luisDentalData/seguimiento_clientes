from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, JSON, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class Client(Base):
    __tablename__ = "clients"

    id = Column(String, primary_key=True, index=True)  # Cambiado a String para soportar formato CLI_XXXXX
    name = Column(String, nullable=False, index=True)
    nombre_normalizado = Column(String, index=True)
    nombres_alternativos = Column(JSON)  # Lista de nombres alternativos
    nombre_contacto = Column(String)
    telefono = Column(String)
    movil = Column(String)
    direccion = Column(String)
    poblacion = Column(String)
    provincia = Column(String)
    nif_cif = Column(String, index=True)
    programa = Column(String)  # Software de gestión (odontonet, gesden, klinikare, etc.)
    fuentes = Column(JSON)  # Lista de fuentes de datos
    status = Column(String, default="ACTIVE")  # ACTIVE or INACTIVE
    is_active = Column(Boolean, default=True, server_default='true', index=True)  # For filtering active clients

    # Relationships
    emails = relationship("ClientEmail", back_populates="client", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="matched_client")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ClientEmail(Base):
    __tablename__ = "client_emails"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(String, ForeignKey("clients.id"))  # Cambiado a String para coincidir con Client.id
    email = Column(String, nullable=False, unique=True, index=True)

    client = relationship("Client", back_populates="emails")

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(String, primary_key=True) # Google Event ID
    analyst_email = Column(String, index=True)
    summary = Column(String)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime, index=True)
    end_time = Column(DateTime)
    attendees = Column(JSON) # Store list of attendee emails
    
    # Matching Status
    is_client_meeting = Column(Boolean, default=False)
    match_status = Column(String) # CONFIRMED, PROBABLE, NO_MATCH, INTERNAL
    match_confidence = Column(Float, nullable=True)
    match_reason = Column(String, nullable=True)
    # Taxonomía rica (Change 5): CLIENTE/INTERNO/VACACIONES/EVENTO/PERSONAL/SIN_CLASIFICAR
    category = Column(String, nullable=True, index=True)

    matched_client_id = Column(String, ForeignKey("clients.id"), nullable=True)  # Cambiado a String para coincidir con Client.id
    matched_client = relationship("Client", back_populates="appointments")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
