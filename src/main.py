
from fastapi import FastAPI, Depends, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, distinct, Integer
from typing import List, Optional
from datetime import datetime
import os

from src.database import get_db
from src.models import Appointment as AppointmentModel, Client as ClientModel
from src.schemas import Appointment, Client

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
    print(f"✅ CORS enabled for frontend: {FRONTEND_URL}")
else:
    print("⚠️  FRONTEND_URL not set - only local origins allowed")

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
    analyst_stats = db.query(
        AppointmentModel.analyst_email,
        func.count(AppointmentModel.id).label('total'),
        func.sum(func.cast(AppointmentModel.is_client_meeting, Integer)).label('confirmed')
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
