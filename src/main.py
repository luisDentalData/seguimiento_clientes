
from fastapi import FastAPI, Depends, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, distinct, Integer
from typing import List, Optional
from datetime import datetime
import os

from src.database import get_db
from src.models import Appointment as AppointmentModel, Client as ClientModel, Analyst as AnalystModel
from src.schemas import (
    Appointment, Client, ClientAdminCreate, ClientAdminUpdate,
    AnalystCreate, AnalystUpdate,
)
from src.services.portfolio import get_client_portfolio
from src.services.category_stats import get_category_stats
from src.services import client_admin
from src.services import analyst_admin

app = FastAPI(title="Dental Data Tracking API")

# ============================================================================
# CORS Configuration - Cloud Run Compatible
# ============================================================================
# ⚠️ IMPORTANTE: Permitir requests desde el frontend en Cloud Run
#
# ¿Por qué configurar CORS?
# - El frontend (Next.js) hace requests desde un origen diferente
# - En local: http://localhost:3000 → http://localhost:8001
# - En Cloud Run: https://frontend-xxx.run.app → https://backend-xxx.run.app
# - Sin CORS, el browser bloquea las requests (CORS policy)
#
# ¿Cómo funciona en Cloud Run?
# 1. Deploy backend PRIMERO, obtener URL
# 2. Deploy frontend con NEXT_PUBLIC_API_URL apuntando al backend
# 3. Redeploy backend con FRONTEND_URL en allow_origins
#
# Variables de entorno requeridas:
# - FRONTEND_URL: URL del frontend en Cloud Run (ej: https://dentaldata-frontend-xxx.run.app)

# Obtener URL del frontend desde variable de entorno
FRONTEND_URL = os.getenv("FRONTEND_URL", "")

# Lista de orígenes permitidos
allowed_origins = [
    "http://localhost:3000",      # Desarrollo local
    "http://127.0.0.1:3000",      # Desarrollo local (IPv4)
]

# En producción (Cloud Run), agregar la URL del frontend
if FRONTEND_URL:
    allowed_origins.append(FRONTEND_URL)
    print(f"[OK] CORS enabled for frontend: {FRONTEND_URL}")
else:
    print("[WARN] FRONTEND_URL not set - only local origins allowed")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Dental Data API is running"}

@app.get("/appointments", response_model=List[Appointment])
def get_appointments(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    analyst_email: Optional[str] = None,
    match_status: Optional[str] = None,
    matched_client_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(AppointmentModel)

    if start_date:
        query = query.filter(AppointmentModel.start_time >= start_date)
    if end_date:
        query = query.filter(AppointmentModel.end_time <= end_date)
    if analyst_email:
        query = query.filter(AppointmentModel.analyst_email == analyst_email)
    if match_status:
        query = query.filter(AppointmentModel.match_status == match_status)
    if matched_client_id:
        query = query.filter(AppointmentModel.matched_client_id == matched_client_id)

    # Eager load client data for appointments
    query = query.options(joinedload(AppointmentModel.matched_client))

    return query.offset(skip).limit(limit).all()

@app.get("/clients", response_model=List[Client])
def get_clients(skip: int = 0, limit: int = 100, active_only: bool = True, db: Session = Depends(get_db)):
    """Get clients. By default returns only active clients."""
    query = db.query(ClientModel)
    if active_only:
        query = query.filter(ClientModel.is_active == True)
    return query.offset(skip).limit(limit).all()


def _client_admin_error_to_http(exc: client_admin.ClientAdminError) -> HTTPException:
    if isinstance(exc, client_admin.ClientNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, client_admin.DuplicateEmailError):
        return HTTPException(status_code=409, detail=str(exc))
    return HTTPException(status_code=400, detail=str(exc))


@app.post("/clients", status_code=201)
def create_client_endpoint(payload: ClientAdminCreate, db: Session = Depends(get_db)):
    """Crea un cliente (ID autogenerado) + sus emails. La DB es la fuente de verdad."""
    try:
        client = client_admin.create_client(db, payload.model_dump())
        db.commit()
    except client_admin.ClientAdminError as exc:
        db.rollback()
        raise _client_admin_error_to_http(exc)
    return {"id": client.id, "name": client.name, "is_active": client.is_active}


@app.put("/clients/{client_id}")
def update_client_endpoint(client_id: str, payload: ClientAdminUpdate, db: Session = Depends(get_db)):
    """Edita datos y/o emails de un cliente existente."""
    try:
        # exclude_unset: solo aplica los campos que el cliente envió.
        client = client_admin.update_client(db, client_id, payload.model_dump(exclude_unset=True))
        db.commit()
    except client_admin.ClientAdminError as exc:
        db.rollback()
        raise _client_admin_error_to_http(exc)
    return {"id": client.id, "name": client.name, "is_active": client.is_active}


@app.post("/clients/{client_id}/deactivate")
def deactivate_client_endpoint(client_id: str, db: Session = Depends(get_db)):
    """Desactiva un cliente (soft-delete). No borra appointments."""
    try:
        client = client_admin.deactivate_client(db, client_id)
        db.commit()
    except client_admin.ClientAdminError as exc:
        db.rollback()
        raise _client_admin_error_to_http(exc)
    return {"id": client.id, "name": client.name, "is_active": client.is_active}

@app.get("/stats/summary")
def get_summary_stats(db: Session = Depends(get_db)):
    """Get summary statistics for the dashboard (only active clients)"""

    # Total clientes activos
    total_clients = db.query(func.count(ClientModel.id)).filter(
        ClientModel.is_active == True
    ).scalar()

    # Clientes activos con reuniones (al menos una CONFIRMED o PROBABLE)
    active_client_ids = db.query(ClientModel.id).filter(ClientModel.is_active == True).subquery()
    clients_with_meetings = db.query(func.count(distinct(AppointmentModel.matched_client_id))).filter(
        AppointmentModel.matched_client_id.in_(active_client_ids),
        AppointmentModel.match_status.in_(['CONFIRMED', 'PROBABLE'])
    ).scalar()

    # Clientes activos sin reuniones
    clients_without_meetings = total_clients - clients_with_meetings

    # Total appointments por status
    status_counts = db.query(
        AppointmentModel.match_status,
        func.count(AppointmentModel.id)
    ).group_by(AppointmentModel.match_status).all()

    # Appointments por analista
    # Solo analistas activas (las inactivas se ocultan como dimensión)
    active_analyst_emails_list = [
        e for (e,) in db.query(AnalystModel.email).filter(AnalystModel.is_active == True).all()
    ]
    analyst_stats = db.query(
        AppointmentModel.analyst_email,
        func.count(AppointmentModel.id).label('total'),
        func.sum(func.cast(AppointmentModel.is_client_meeting, Integer)).label('confirmed')
    ).filter(
        AppointmentModel.analyst_email.in_(active_analyst_emails_list)
    ).group_by(AppointmentModel.analyst_email).all()

    return {
        "total_clients": total_clients,
        "clients_with_meetings": clients_with_meetings,
        "clients_without_meetings": clients_without_meetings,
        "status_distribution": [{"status": s, "count": c} for s, c in status_counts],
        "analyst_stats": [
            {
                "analyst": a,
                "total_appointments": t,
                "confirmed_meetings": c or 0
            } for a, t, c in analyst_stats
        ]
    }

@app.get("/clients/portfolio")
def get_clients_portfolio(
    analyst_email: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    """Portfolio de clientes con estado de seguimiento calculado en el BACKEND.

    Estado (OK/ATTENTION/CRITICAL) calculado desde HOY en el servidor — una sola
    verdad para todos los analistas (antes lo calculaba el navegador).
    Ordenado por prioridad: CRITICAL → ATTENTION → OK.
    """
    entries = get_client_portfolio(
        db, analyst_email=analyst_email, active_only=active_only
    )
    return [
        {
            "id": e.id,
            "name": e.name,
            "nombre_contacto": e.nombre_contacto,
            "programa": e.programa,
            "provincia": e.provincia,
            "last_session": e.last_session.isoformat() if e.last_session else None,
            "days_since": e.days_since,
            "valid_sessions": e.valid_sessions,
            "last_analyst": e.last_analyst,
            "status": e.status.value,
        }
        for e in entries
    ]


def _analyst_error_to_http(exc: analyst_admin.AnalystAdminError) -> HTTPException:
    if isinstance(exc, analyst_admin.AnalystNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, analyst_admin.DuplicateAnalystError):
        return HTTPException(status_code=409, detail=str(exc))
    return HTTPException(status_code=400, detail=str(exc))


def _analyst_dict(a) -> dict:
    return {"email": a.email, "name": a.name, "is_active": a.is_active}


@app.get("/analysts")
def list_analysts_endpoint(active_only: bool = False, db: Session = Depends(get_db)):
    """Lista de analistas. active_only=true para dropdowns; sin él incluye inactivas
    (para resolver nombres en vistas históricas)."""
    return [_analyst_dict(a) for a in analyst_admin.list_analysts(db, active_only=active_only)]


@app.post("/analysts", status_code=201)
def create_analyst_endpoint(payload: AnalystCreate, db: Session = Depends(get_db)):
    try:
        analyst = analyst_admin.create_analyst(db, payload.email, payload.name)
        db.commit()
    except analyst_admin.AnalystAdminError as exc:
        db.rollback()
        raise _analyst_error_to_http(exc)
    return _analyst_dict(analyst)


@app.put("/analysts/{email}")
def update_analyst_endpoint(email: str, payload: AnalystUpdate, db: Session = Depends(get_db)):
    try:
        analyst = analyst_admin.update_analyst(db, email, name=payload.name, is_active=payload.is_active)
        db.commit()
    except analyst_admin.AnalystAdminError as exc:
        db.rollback()
        raise _analyst_error_to_http(exc)
    return _analyst_dict(analyst)


@app.post("/analysts/{email}/deactivate")
def deactivate_analyst_endpoint(email: str, db: Session = Depends(get_db)):
    try:
        analyst = analyst_admin.deactivate_analyst(db, email)
        db.commit()
    except analyst_admin.AnalystAdminError as exc:
        db.rollback()
        raise _analyst_error_to_http(exc)
    return _analyst_dict(analyst)


@app.get("/stats/categories")
def get_category_stats_endpoint(
    analyst_email: Optional[str] = None,
    month: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Carga de reuniones por categoría (total, por analista, por mes).

    `total` y `by_analyst` respetan analista+mes; `by_month` ignora el mes
    (para mostrar la evolución temporal).
    """
    analyst = analyst_email if analyst_email and analyst_email != "all" else None
    period = month if month and month != "all" else None
    return get_category_stats(db, analyst_email=analyst, month=period)


@app.get("/clients/with-meetings")
def get_clients_with_meetings(active_only: bool = True, db: Session = Depends(get_db)):
    """Get list of active clients that have at least one meeting

    Optimized version: Uses single JOIN query instead of N+1 queries
    """

    # Single query with JOIN and GROUP BY to get meeting counts
    query = (
        db.query(
            ClientModel.id,
            ClientModel.name,
            ClientModel.nombre_contacto,
            ClientModel.programa,
            ClientModel.provincia,
            func.count(AppointmentModel.id).label('meeting_count')
        )
        .join(
            AppointmentModel,
            ClientModel.id == AppointmentModel.matched_client_id
        )
        .filter(
            AppointmentModel.match_status.in_(['CONFIRMED', 'PROBABLE'])
        )
        .group_by(
            ClientModel.id,
            ClientModel.name,
            ClientModel.nombre_contacto,
            ClientModel.programa,
            ClientModel.provincia
        )
    )

    if active_only:
        query = query.filter(ClientModel.is_active == True)

    # Execute query and convert to list of dicts
    results = query.all()

    return [
        {
            "id": row.id,
            "name": row.name,
            "nombre_contacto": row.nombre_contacto,
            "programa": row.programa,
            "provincia": row.provincia,
            "meeting_count": row.meeting_count
        }
        for row in results
    ]

@app.get("/clients/without-meetings")
def get_clients_without_meetings(db: Session = Depends(get_db)):
    """Get list of clients that have NO meetings"""

    # Get IDs of clients WITH meetings
    client_ids_with_meetings = db.query(distinct(AppointmentModel.matched_client_id)).filter(
        AppointmentModel.matched_client_id.isnot(None),
        AppointmentModel.match_status.in_(['CONFIRMED', 'PROBABLE'])
    ).all()

    client_ids_with_meetings = [c[0] for c in client_ids_with_meetings]

    # Get clients WITHOUT meetings
    if client_ids_with_meetings:
        clients = db.query(ClientModel).filter(
            ~ClientModel.id.in_(client_ids_with_meetings)
        ).all()
    else:
        clients = db.query(ClientModel).all()

    result = []
    for client in clients:
        client_dict = {
            "id": client.id,
            "name": client.name,
            "nombre_contacto": client.nombre_contacto,
            "programa": client.programa,
            "provincia": client.provincia
        }
        result.append(client_dict)

    return result


@app.get("/clients/{client_id}")
def get_client_detail(client_id: str, db: Session = Depends(get_db)):
    """Detalle completo de un cliente (incluye emails) — para editar en la UI.

    Declarado DESPUÉS de las rutas estáticas /clients/... para no eclipsarlas.
    """
    client = db.get(ClientModel, client_id)
    if client is None:
        raise HTTPException(status_code=404, detail=f"Cliente {client_id} no existe")
    emails = [ce.email for ce in client.emails]
    return {
        "id": client.id,
        "name": client.name,
        "nombre_contacto": client.nombre_contacto,
        "telefono": client.telefono,
        "movil": client.movil,
        "direccion": client.direccion,
        "poblacion": client.poblacion,
        "provincia": client.provincia,
        "nif_cif": client.nif_cif,
        "programa": client.programa,
        "nombres_alternativos": client.nombres_alternativos or [],
        "status": client.status,
        "is_active": client.is_active,
        "emails": emails,
    }

@app.post("/etl/run")
async def run_etl_endpoint(background_tasks: BackgroundTasks):
    """
    Ejecuta el proceso ETL manualmente para actualizar los datos del calendario.
    Esta es una solución temporal para desarrollo. En producción se usará un scheduler.
    """
    def execute_etl():
        """Ejecuta el ETL en el background"""
        try:
            print("===== INICIANDO ETL =====")
            # Importar y ejecutar directamente la función ETL
            from src.etl import run_etl
            run_etl()
            print("===== ETL COMPLETADO EXITOSAMENTE =====")
        except Exception as e:
            print(f"===== ERROR EN ETL: {str(e)} =====")
            import traceback
            traceback.print_exc()

    # Ejecutar ETL en background para no bloquear la respuesta
    background_tasks.add_task(execute_etl)

    return {
        "status": "success",
        "message": "ETL iniciado en segundo plano. Los datos se actualizarán en breve.",
        "note": "Esta es una función temporal de desarrollo. En producción se usará un scheduler automático."
    }

@app.get("/etl/logs")
def get_etl_logs(limit: int = 100):
    """
    Obtiene las últimas líneas del log de ETL.
    """
    try:
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        log_file = os.path.join(project_root, 'logs', 'etl.log')

        if not os.path.exists(log_file):
            return {"logs": [], "message": "No log file found"}

        with open(log_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            recent_lines = lines[-limit:] if len(lines) > limit else lines

        return {
            "logs": [line.strip() for line in recent_lines],
            "total_lines": len(recent_lines),
            "log_file": log_file
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading logs: {str(e)}")

@app.get("/etl/summaries")
def get_etl_summaries(limit: int = 10):
    """
    Obtiene los últimos resúmenes de ejecución de ETL en formato JSON.
    """
    try:
        import json
        import glob

        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        logs_dir = os.path.join(project_root, 'logs')

        if not os.path.exists(logs_dir):
            return {"summaries": [], "message": "No logs directory found"}

        # Buscar todos los archivos de resumen
        summary_files = glob.glob(os.path.join(logs_dir, 'etl_summary_*.json'))
        summary_files.sort(reverse=True)  # Más recientes primero

        summaries = []
        for summary_file in summary_files[:limit]:
            try:
                with open(summary_file, 'r', encoding='utf-8') as f:
                    summary_data = json.load(f)
                    summaries.append(summary_data)
            except Exception as e:
                print(f"Error reading {summary_file}: {e}")
                continue

        return {
            "summaries": summaries,
            "total": len(summaries)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading summaries: {str(e)}")
