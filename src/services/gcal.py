
import os
import pickle
from datetime import datetime
from typing import List, Dict, Optional
from google.oauth2.credentials import Credentials
from google.oauth2 import service_account
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from ..config import GOOGLE_CREDENTIALS_PATH, IMPERSONATE_EMAIL

SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']

class GCalService:
    def __init__(self, credentials_path: str = GOOGLE_CREDENTIALS_PATH, impersonate_email: str = None):
        self.creds = self._authenticate(credentials_path, impersonate_email)
        self.service = build('calendar', 'v3', credentials=self.creds)

    def _authenticate(self, credentials_path: str, impersonate_email: str):
        """
        Authenticate with Google Calendar API using Service Account.

        WARNING: CLOUD RUN COMPATIBLE: Solo usa Service Account (no token.pickle)

        Por que NO usar OAuth Token (token.pickle) en Cloud Run?
        1. Secrets se montan como READ-ONLY en Cloud Run
        2. OAuth tokens expiran cada 1 hora y necesitan refresh
        3. Al refrescar, se intenta ESCRIBIR token.pickle → FALLO
        4. Cloud Run es stateless → cambios en disco se pierden

        Service Account es mejor para Cloud Run porque:
        - No requiere refresh manual (token permanente)
        - Solo lectura del archivo credentials.json
        - Funciona con Domain-Wide Delegation

        Configuración requerida en Google Workspace:
        1. Crear Service Account en Google Cloud Console
        2. Habilitar Domain-Wide Delegation
        3. Agregar scope: https://www.googleapis.com/auth/calendar.readonly
        4. Autorizar Client ID en Admin Console → Security → API Controls
        """

        # OAuth Token (preferido para desarrollo local)
        token_path = 'token.pickle'
        if os.path.exists(token_path):
            print("Loading OAuth token from pickle...")

            with open(token_path, 'rb') as token:
                creds = pickle.load(token)

            if creds and creds.valid:
                return creds

            if creds and creds.expired and creds.refresh_token:
                print("Refreshing OAuth token...")
                try:
                    creds.refresh(Request())
                    # Intentar guardar el token refrescado
                    with open(token_path, 'wb') as token:
                        pickle.dump(creds, token)
                    print("[OK] Token refreshed and saved")
                    return creds
                except PermissionError:
                    print("[ERROR] Cannot write token.pickle (read-only mount)")
                    print("[INFO] Token expired but cannot refresh - using existing")
                    return creds

        # Service Account (fallback para producción)
        if os.path.exists(credentials_path):
            print("[AUTH] Loading Service Account credentials...")
            creds = service_account.Credentials.from_service_account_file(
                credentials_path, scopes=SCOPES
            )

            if impersonate_email:
                print(f"[IMPERSONATE] Acting as {impersonate_email}...")
                # Domain-Wide Delegation: Actúa como el usuario especificado
                # Requiere que el Service Account esté autorizado en Google Workspace
                return creds.with_subject(impersonate_email)

            print("[OK] Service Account authenticated successfully")
            return creds

        raise FileNotFoundError(
            f"[ERROR] No valid credentials found!\n"
            f"   Tried: {credentials_path} (Service Account - preferred)\n"
            f"          {token_path} (OAuth Token - only for dev)\n"
            f"[INFO] For Cloud Run: Use Service Account with Domain-Wide Delegation"
        )

    def get_events(self, calendar_id: str, start_date: datetime, end_date: datetime) -> List[Dict]:
        """Fetch events for a specific calendar within a date range."""
        events_list = []
        page_token = None
        
        # Ensure UTC and format properly (v3 expects RFC3339)
        # If dates are naive, assume UTC. If aware, convert to UTC.
        if start_date.tzinfo is None:
            time_min = start_date.isoformat() + 'Z'
        else:
            time_min = start_date.isoformat()
            
        if end_date.tzinfo is None:
            time_max = end_date.isoformat() + 'Z'
        else:
            time_max = end_date.isoformat()
        
        print(f"  Querying {calendar_id} from {time_min} to {time_max}")
        
        while True:
            try:
                events_result = self.service.events().list(
                    calendarId=calendar_id,
                    timeMin=time_min,
                    timeMax=time_max,
                    maxResults=2500,
                    singleEvents=True,
                    orderBy='startTime',
                    pageToken=page_token
                ).execute()
                
                events = events_result.get('items', [])
                events_list.extend(events)
                
                page_token = events_result.get('nextPageToken')
                if not page_token:
                    break
            except Exception as e:
                print(f"  [ERROR] GCal API Error for {calendar_id}: {e}")
                break
                
        return events_list
