# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Seguimiento Clientes** is a dental data tracking system that monitors analyst meetings with clients. It consists of:
- **Backend**: Python FastAPI service that fetches Google Calendar events, matches them with clients using fuzzy matching, and stores them in PostgreSQL
- **Frontend**: Next.js 16 dashboard with TypeScript that displays meeting analytics in real-time with interactive visualizations

The system automatically identifies which calendar events are actual client meetings versus internal meetings by matching attendee emails and event titles against a client database.

## Deployment Environments

### Local Development

#### Conectar a la base de datos de producción (recomendado)

El equipo comparte la misma Cloud SQL de producción también en desarrollo. Para conectarte:

**Requisitos previos (una sola vez por máquina)**:
1. Instalar [gcloud CLI](https://cloud.google.com/sdk/docs/install)
2. Autenticarse: `gcloud auth application-default login`
3. Descargar `cloud-sql-proxy.exe` desde la [página de releases](https://github.com/GoogleCloudPlatform/cloud-sql-proxy/releases/latest) (buscar `cloud-sql-proxy.x64.exe`) y copiarlo como `cloud-sql-proxy.exe` en la raíz del proyecto

**Cada vez que vayas a desarrollar**:
```bash
# Terminal 1: Proxy (mantener corriendo)
start_proxy.bat

# Terminal 2: Backend
python -m uvicorn src.main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 3: Frontend
cd dashboard && npm run dev
```

**`.env` para conectar via proxy** (puerto 5433):
```
DATABASE_URL=postgresql+pg8000://postgres:dentaldata@127.0.0.1:5433/dentaldata
```
Ver `env.example` para referencia completa.

**Local Port Configuration**:
- Cloud SQL Proxy: puerto **5433** (túnel local → Cloud SQL)
- Backend runs on port **8000**
- Frontend runs on port **3000**
- API client ([dashboard/lib/api.ts](dashboard/lib/api.ts)) configured to `http://127.0.0.1:8000`

### Production (Google Cloud Run)

**Deployed Services**:
- **Backend**: https://dentaldata-backend-243744598910.us-central1.run.app
- **Frontend**: https://dentaldata-frontend-243744598910.us-central1.run.app
- **Database**: Cloud SQL PostgreSQL (europe-southwest1)

**Cloud Run Configuration**:
- Region: `us-central1`
- Memory: 512Mi (both services)
- CPU: 1 vCPU
- Timeout: Backend 600s, Frontend 60s
- Min instances: 0 (scales to zero)
- Max instances: Backend 10, Frontend 5

**Quick Deploy Commands**:
> Note: Deployments run automatically via GitHub Actions on push to `master`. Use these commands only for manual deploys.
```bash
# Deploy backend
gcloud run deploy dentaldata-backend \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-cloudsql-instances=seguimientoclientes-483013:europe-southwest1:dentaldata-db \
  --set-secrets="DATABASE_URL=dentaldata-db-url:latest,/secrets/credentials.json=google-credentials:latest,/token/token.pickle=google-oauth-token:latest" \
  --env-vars-file=.env.yaml \
  --memory=512Mi \
  --cpu=1 \
  --timeout=600 \
  --max-instances=10 \
  --min-instances=0 \
  --no-use-http2

# Deploy frontend
cd dashboard
gcloud run deploy dentaldata-frontend \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory=512Mi \
  --cpu=1 \
  --timeout=60 \
  --max-instances=5 \
  --min-instances=0 \
  --no-use-http2
```

### Database Operations
```bash
# ⚠️ WARNING: Load clients from clientes_maestro.json - DROPS ALL TABLES!
# Only use for initial setup or disaster recovery
# For adding new clients in production, see "Priority 0" improvements
python src/scripts/load_clientes_maestro.py

# Initialize database tables (only if starting fresh)
python src/scripts/init_db.py

# Run ETL process to sync Google Calendar events
python src/etl.py

# Check database contents
python src/scripts/check_db.py

# Export database to JSON
python src/scripts/export_db_to_json.py
```

**✅ El ETL y la carga de clientes son INCREMENTALES (no destructivos)**:
- `src/scripts/sync_clientes_maestro.py` — **usar esto para el día a día**. Upsert por ID, nunca toca `appointments`.
- `src/etl.py` — ya es incremental: INSERT si el evento es nuevo, UPDATE solo si cambió algo, sin tocar lo que no cambió.
- `src/scripts/load_clientes_maestro.py` — **solo disaster recovery**. Requiere `ALLOW_DESTRUCTIVE_LOAD=yes` o falla con error explícito. Dropea todas las tablas.

**Flujo correcto para añadir/actualizar clientes**:
```bash
# 1. Editar clientes_maestro.json
# 2. Sync no destructivo (no toca appointments)
python src/scripts/sync_clientes_maestro.py
# 3. Ejecutar ETL para re-matchear con los nuevos clientes
python src/etl.py
```

### Frontend Commands
```bash
cd dashboard

# Install dependencies
npm install

# Run development server (port 3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Backend Package Management
```bash
# Install Python dependencies
pip install -r requirements.txt

# Key dependencies:
# - fastapi, uvicorn - API framework
# - sqlalchemy, pg8000 - Database ORM and PostgreSQL driver
# - google-api-python-client - Google Calendar integration
# - python-dotenv - Environment variables
```

### Frontend Package Management
```bash
cd dashboard
npm install

# Key dependencies:
# - next@15, react@19 - Frontend framework
# - leaflet, react-leaflet - Interactive map visualization
# - swr - Data fetching with auto-refresh
# - date-fns - Date manipulation
# - lucide-react - Icon library
# - tailwindcss - Styling
```

## Architecture Overview

### Data Flow
1. **ETL Process** ([src/etl.py](src/etl.py)) runs periodically to:
   - Fetch calendar events from Google Calendar via [GCalService](src/services/gcal.py) for configured analyst emails
   - Match events to clients using [Matcher](src/services/matching.py) which checks attendee emails and fuzzy-matches event titles against client names
   - Store/update appointments in PostgreSQL with match confidence scores and status (CONFIRMED, PROBABLE, NO_MATCH, INTERNAL)

2. **API Layer** ([src/main.py](src/main.py)) exposes:
   - `GET /appointments` - Query appointments with filters (date range, analyst, match status)
   - `GET /appointments?limit=1000` - Query with limit (used by new Clientes module)
   - `GET /clients` - List all clients
   - `GET /stats/summary` - Dashboard statistics (total clients, clients with/without meetings, status distribution, analyst stats)
   - `GET /clients/with-meetings` - List of clients that have meetings (includes meeting count)
   - `GET /clients/without-meetings` - List of clients without meetings
   - CORS configured for `http://127.0.0.1:3000` and `http://localhost:3000`

3. **Frontend** ([dashboard/](dashboard/)) - Modern interactive dashboard with multiple views:

   **a) Overview Page** ([dashboard/app/page.tsx](dashboard/app/page.tsx))
   - Total clients, clients with/without meetings, total events
   - Analyst performance charts with progress bars
   - Status distribution (CONFIRMED, PROBABLE, NO_MATCH)
   - Clickable cards to navigate to detail views

   **b) Clientes Page** ([dashboard/app/clientes/page.tsx](dashboard/app/clientes/page.tsx)) - **REDESIGNED with Product Designer specifications**
   - **Business Logic**: Only counts VALID sessions (`is_client_meeting=true`, includes CONFIRMED and PROBABLE)
   - **Client Status Classification** (ALWAYS calculated from TODAY):
     - **OK** (Green): Last valid session ≤30 days ago (from today)
     - **ATTENTION** (Yellow): Last valid session 31-60 days ago (from today)
     - **CRITICAL** (Red): Last valid session >60 days ago OR no valid sessions
   - **Status-Oriented Cards**: Click to filter by status
   - **Search**: Filter by client name or contact name
   - **Unified Table** with columns:
     - Estado (color-coded badge with icon)
     - Cliente (name, contact, programa, provincia)
     - Última Sesión (formatted date)
     - Días sin Sesión (color-coded: green/yellow/red, calculated from today)
     - Sesiones (valid session count)
     - Analista (last analyst name)
     - Acciones (Calendar & Clock buttons)
   - **Priority Sorting**: CRITICAL → ATTENTION → OK, then by days descending
   - **Analyst Filter Only**: Simple dropdown to filter by analyst (no date filters - status is always from TODAY)
   - Auto-refresh every 30 seconds
   - **Key Design Decision**: Date filters removed to avoid confusion - client status is ALWAYS calculated from current date, showing real-time portfolio health

   **c) Reuniones Page** ([dashboard/app/reuniones/page.tsx](dashboard/app/reuniones/page.tsx))
   - Full calendar events list with all appointment details
   - Filter by analyst, month, match status
   - Shows meeting title, date, attendees, match confidence

   **d) Mapa Page** ([dashboard/app/mapa/page.tsx](dashboard/app/mapa/page.tsx)) - **Provincial Map View**
   - **Interactive Leaflet Map**: Real map of Spain with CARTO Voyager tiles
   - **Province Visualization**: Circle markers sized by meeting concentration
   - **Vibrant Color Gradient**:
     - Pink/Magenta (≥80%): Highest concentration
     - Violet (≥60%): High concentration
     - Blue (≥40%): Medium concentration
     - Cyan (≥20%): Low concentration
     - Emerald (<20%): Very low concentration
   - **Interactive Features**:
     - Click provinces to view client details
     - Tooltips showing meetings and clients count
     - Selected province gets golden border
   - **Province Statistics List**: Sortable by meetings count
   - **Client Detail Panel**: Shows clients in selected province
   - Filter by analyst and month

   **e) Shared Components**:
   - **Header** ([dashboard/components/Header.tsx](dashboard/components/Header.tsx)): Page title and subtitle
   - **FilterBar** ([dashboard/components/FilterBar.tsx](dashboard/components/FilterBar.tsx)): Analyst and month selection
   - **Sidebar** ([dashboard/components/Sidebar.tsx](dashboard/components/Sidebar.tsx)): Navigation menu
   - **SpainMapLeaflet** ([dashboard/components/SpainMapLeaflet.tsx](dashboard/components/SpainMapLeaflet.tsx)): Leaflet map component with 70+ Spanish province coordinates

### Database Schema

**Tables** (defined in [src/models.py](src/models.py)):
- `clients` - Client records with comprehensive data:
  - Basic: name, nombre_normalizado, nombres_alternativos, nombre_contacto
  - Contact: telefono, movil, direccion, poblacion, provincia
  - Business: nif_cif, programa (software de gestión), fuentes, status
  - Primary key is String type (format: CLI_XXXXX) not Integer
- `client_emails` - Email addresses linked to clients (one-to-many)
- `appointments` - Calendar events with match metadata (status, confidence, matched_client_id)
  - Uses Google Calendar event ID as primary key (String type)

**Key Relationships**:
- Client ↔ ClientEmail (one-to-many)
- Client ↔ Appointment (one-to-many via matched_client_id)

**Client Data Source**: [clientes_maestro.json](clientes_maestro.json) - 154 clients with complete information

### Matching Logic

The [Matcher](src/services/matching.py) uses a **multi-tier matching strategy with word-boundary matching**:

#### 1. Personal Event Detection (Priority 0)
- **Status**: `NO_MATCH`
- **Confidence**: 0.0
- **Rule**: Title matches personal event keywords (casa, comida, llamar, etc.)
- **Purpose**: Filters out personal calendar events to prevent false matches

#### 2. Internal Meeting Detection (Priority 1)
- **Status**: `INTERNAL`
- **Confidence**: 1.0
- **Rule**: All attendees are from `@dentaldata.es` domain
- **Purpose**: Filters out internal team meetings to prevent false client matches

#### 3. Email Exact Match (Priority 2)
- **Status**: `CONFIRMED`
- **Confidence**: 1.0
- **Rule**: Event attendee email matches exactly with `client_emails` table
- **Purpose**: Highest confidence client identification via email

#### 4. Name Exact Match with Word Boundaries (Priority 3)
- **Status**: `CONFIRMED`
- **Confidence**: 0.94-0.98
- **Rules**:
  - Normalized name in event title (whole word) → 98%
  - Main name in event title (whole word) → 97%
  - Alternative names in event title (whole word) → 96%
  - Contact name in event title (whole word) → 94%
- **Algorithm**: Uses `_word_match()` with regex word boundaries (`\b`) to prevent substring matches
- **Purpose**: High confidence matches when client name appears as complete words in meeting title
- **Critical Improvement**: Prevents "antia dental" from matching "garantia dental" by requiring whole-word matches

#### 5. Fuzzy Matching (Priority 4) - **DISABLED**
- **Status**: N/A
- **Confidence**: N/A
- **Reason**: Disabled due to excessive false positives (e.g., "garantia" → "antia" with 70% similarity)
- **Alternative**: System now relies exclusively on exact word-boundary matching for accuracy

#### 6. No Match (Priority 5)
- **Status**: `NO_MATCH`
- **Confidence**: 0.0
- **Rule**: None of the above rules matched
- **Purpose**: Meeting exists but couldn't be matched to a client

**Key Features**:
- **Word-boundary matching** prevents substring false positives
- Internal meeting detection prevents false positives
- Personal event detection filters out non-business calendar items
- Email matching provides highest confidence
- Text normalization: lowercases, removes special chars, normalizes spaces
- Cached client data for performance
- All meetings stored regardless of match status for audit trail
- **Fuzzy matching disabled** to improve precision over recall

**Business Rules for Valid Sessions**:
- A **valid client session** is defined as:
  - `is_client_meeting = true` (matched to a client)
  - Includes both `CONFIRMED` and `PROBABLE` matches
- `INTERNAL` and `NO_MATCH` meetings are NOT counted as client sessions
- This is used in the Clientes module for status classification
- **Important**: We count PROBABLE matches because clients may attend meetings even if they don't confirm attendance

### Google Calendar Authentication

[GCalService](src/services/gcal.py) supports two auth methods:
1. **OAuth Token** (preferred): Uses `token.pickle` for user delegation
2. **Service Account**: Falls back to `credentials.json` with domain-wide delegation via `IMPERSONATE_EMAIL`

**Calendar Configuration**:
- Queries shared calendar: `luis@dentaldata.es`
- Tracks 3 analysts via `ANALYST_EMAILS` environment variable
- Events identified as analyst events if organizer OR any attendee matches analyst emails
- Date range configured via `DEFAULT_START_DATE` / `DEFAULT_END_DATE`

## Configuration

### Environment Variables ([.env](.env))
```bash
DATABASE_URL=postgresql+pg8000://postgres:dentaldata@localhost:5432/dentaldata
GOOGLE_CREDENTIALS_PATH=credentials.json
ANALYST_EMAILS=analyst1@dentaldata.es,analyst2@dentaldata.es,analyst3@dentaldata.es
IMPERSONATE_EMAIL=luis@dentaldata.es
```

### Additional Configuration ([src/config.py](src/config.py))
```python
FUZZY_MATCH_THRESHOLD = 85  # Minimum similarity % for fuzzy matching
DEFAULT_START_DATE = "2025-09-01"
DEFAULT_END_DATE = "2025-12-31"
```

## Key Implementation Notes

### Backend
- **Database Connection**: Uses SQLAlchemy with `pg8000` driver (not psycopg2) for PostgreSQL
- **API Dependency Injection**: `get_db()` provides database sessions to endpoints via FastAPI's Depends
- **CORS**: Explicitly allows `http://127.0.0.1:3000` and `http://localhost:3000` to prevent IPv4/IPv6 mismatches
- **Pydantic Schemas** ([src/schemas.py](src/schemas.py)): Define API request/response models separate from SQLAlchemy models
  - Important: `Client.id` and `Appointment.matched_client_id` are String type, not Integer

### Frontend
- **Framework**: Next.js 15 with React 19, TypeScript 5.9, App Router
- **API Client** ([dashboard/lib/api.ts](dashboard/lib/api.ts)): Axios instance configured to `http://127.0.0.1:8000`
- **Data Fetching**: Uses SWR with 30-second polling interval for real-time updates
- **Styling**: Tailwind CSS v4 with dark theme (slate-950 background)
- **TypeScript Types** ([dashboard/lib/types.ts](dashboard/lib/types.ts)): Match Pydantic schemas exactly
- **Maps**: Leaflet with CARTO Voyager tiles for vibrant, professional appearance
- **Icons**: Lucide React icon library
- **Date Handling**: date-fns with Spanish locale (es)
- **Layout**:
  - Sidebar navigation on left ([dashboard/components/Sidebar.tsx](dashboard/components/Sidebar.tsx))
  - Main content area with padding
  - Leaflet CSS imported in [dashboard/app/layout.tsx](dashboard/app/layout.tsx)

### ETL Process

**Architecture** ([src/etl.py](src/etl.py)):
1. **Parallel fetch**: `ThreadPoolExecutor` creates one `GCalService` per analyst thread. Each thread uses its own httplib2 HTTP transport — sharing a single service across threads causes mixed responses and broken pagination (confirmed in production).
2. **Deduplication**: Events from multiple analysts are deduplicated by event ID; organizer's copy is preferred.
3. **In-memory matching**: `Matcher` loads all clients once; no per-event DB queries.
4. **Bulk upsert**: `sqlalchemy.dialects.postgresql.insert` with `ON CONFLICT DO UPDATE` in batches of 500. Critical for cross-region Cloud SQL (europe-southwest1 → us-central1, ~100ms per round-trip). 14 round-trips instead of 6969.
5. **Clinic sync**: runs after main ETL to replicate appointments across multi-location clinic groups.

**API endpoint** ([src/main.py](src/main.py)): `/etl/run` is SYNCHRONOUS — runs blocking ETL in thread pool via `asyncio.get_running_loop().run_in_executor(None, run_etl)`. Must NOT use `BackgroundTasks` — Cloud Run kills background tasks after the HTTP response is sent.

- Event IDs (from Google Calendar) serve as primary keys in `appointments` table to prevent duplicates
- Stores all meetings regardless of match status for complete audit trail
- ETL takes ~89s in production (3 analysts, ~7000 events, 14 bulk batches)

### Adding New Clients Workflow

**Current Process** (⚠️ Inefficient - See Priority 0 improvements):

1. **Edit Master File**: Add new client to [clientes_maestro.json](clientes_maestro.json) with all data:
   ```json
   {
     "id": "DD-00130",  // Format: DD-XXXXX (not CLI_XXXXX)
     "name": "Hondarribia Klinika",
     "nombre_normalizado": "hondarribia klinika",  // lowercase, no accents
     "nombres_alternativos": ["CD HABINMET12 SLP"],  // optional
     "nombre_contacto": "Ernesto Toledo",
     "emails": ["hondarribiaklinika@gmail.com"],
     "telefono": null,
     "movil": "+34635 47 06 56",
     "nif_cif": "B75061044",
     "direccion": "Bernat Etxepare 6",
     "poblacion": "Hondarribia",
     "provincia": "Gipuzkoa",
     "programa": "klinikare",  // Dental software
     "fuentes": ["crm-publicidad"],
     "status": "ACTIVE"
   }
   ```

2. **Load to Database**: Run script **INSIDE DOCKER CONTAINER**:
   ```bash
   docker exec dentaldata-backend python src/scripts/load_clientes_maestro.py
   ```
   - ⚠️ **WARNING**: This script **DROPS ALL TABLES** and recreates them from scratch
   - Creates records in `clients` table (130 clients as of Jan 2026)
   - Automatically creates linked records in `client_emails` table (one per email in array)
   - **IMPORTANT**: This is **DESTRUCTIVE** - all appointments are recreated, not preserved
   - Output shows: "MIGRACION COMPLETADA - Clientes insertados: 130, Emails registrados: 166"

3. **Run ETL**: Execute **INSIDE DOCKER CONTAINER**:
   ```bash
   docker exec dentaldata-backend python src/etl.py
   ```
   - ETL reads Google Calendar events from 3 analysts
   - **Matcher** ([src/services/matching.py](src/services/matching.py)) **now queries the database dynamically** for each event:
     - ✅ **No backend restart required** - ETL automatically sees new clients
     - **Email match** (100% confidence): Attendee email in `client_emails` → CONFIRMED
     - **Name match** (94-98% confidence): Name appears as whole word in title → CONFIRMED
     - Uses word-boundary matching (`\b`) to prevent false positives
   - Creates/updates records in `appointments` table with `matched_client_id`
   - Logs show: `Match: CONFIRMED → Hondarribia Klinika (100%)`

4. **Verify in Dashboard** (Optional):
   - Frontend: http://localhost:3000/clientes (local) or https://dentaldata-frontend-243744598910.us-central1.run.app (production)
   - New client should appear with matched appointments

5. **Data Flow**:
   ```
   clientes_maestro.json (130 clients)
     ↓ (load_clientes_maestro.py - DROPS & RECREATES ALL TABLES!)
   clients table (130 records) + client_emails table (166 records)
     ↓ (etl.py + Matcher - queries DB dynamically, no restart needed!)
   appointments table (3,176 events processed, 1,218 matched)
     ↓ (Backend API reads from DB)
   Frontend Dashboard (shows real-time data)
   ```

**✅ SIMPLIFIED EXECUTION ORDER** (as of January 6, 2026):
```bash
# 1. Load clients (drops all tables, recreates from JSON)
docker exec dentaldata-backend python src/scripts/load_clientes_maestro.py

# 2. Run ETL (match events to clients - no restart needed!)
docker exec dentaldata-backend python src/etl.py

# 3. Verify in dashboard
open http://localhost:3000/clientes
```

**⚠️ Common Mistake**: Running ETL BEFORE loading clients results in `NO_MATCH` for new client events. The matching algorithm can't find clients that don't exist in the database yet.

**⚠️ Remaining Issue**: Adding 1 client still requires dropping and recreating 130 clients, 166 emails, and 3,176+ appointments. See "Priority 0" improvements for the incremental sync solution.

**✅ Fixed Issue** (January 6, 2026): Backend restart is NO LONGER REQUIRED. The `Matcher` class now queries the database dynamically for each event, eliminating the need for in-memory caching and manual restarts.

#### Clinic Synchronization Logic
The ETL implements **automatic appointment synchronization** for clinic groups that share the same meetings. This is critical for multi-location clinics where one meeting serves multiple branches:

**Synchronized Clinic Groups** (defined in [src/etl.py](src/etl.py)):

1. **Amelar** (2 clinics):
   - Source: CLI_00018 (amelar bellavista)
   - Target: CLI_00045 (amelar sevilla este)

2. **Junyent** (2 clinics):
   - Source: CLI_00078 (junyent manresa)
   - Target: CLI_00089 (junyent smile)

3. **Almidental** (2 clinics):
   - Source: CLI_00008 (almidental pedreguer)
   - Target: CLI_00126 (almidental ondara)

4. **Smilodon** (2 clinics):
   - Source: CLI_00112 (smilodon getafe)
   - Target: CLI_00113 (smilodon madrid)

5. **Garantía Dental** (2 clinics):
   - Source: CLI_00080 (garantia dental ayala)
   - Target: CLI_00081 (garantia dental quintana)

6. **Elite** (7 clinics):
   - Source: CLI_00070 (elite alcala i canovas)
   - Targets: CLI_00071 (lopez figueroa), CLI_00072 (antequera), CLI_00073 (castellana), CLI_00074 (coslada), CLI_00075 (las rozas), CLI_00076 (leganes)

**Synchronization Mechanism**:
- Runs automatically after main ETL processing
- Creates duplicate appointments with composite IDs: `{original_id}_{target_client_id}`
- Updates existing duplicates to match source appointments
- Preserves analyst, dates, and meeting details
- Adds prefix to match_reason for traceability (e.g., "[ELITE CASTELLANA]")
- Ensures all clinics in a group show identical last session dates

**Important**: When adding new multi-location clinics, add synchronization logic to ETL following the existing pattern.

## Common Development Patterns

### Adding New API Endpoints
1. Define Pydantic schema in [src/schemas.py](src/schemas.py)
2. Add route in [src/main.py](src/main.py) using `@app.get()` or `@app.post()`
3. Use `db: Session = Depends(get_db)` for database access
4. Update TypeScript types in [dashboard/lib/types.ts](dashboard/lib/types.ts)
5. Test with `GET http://127.0.0.1:8000/endpoint`

### Modifying Database Schema
1. Update SQLAlchemy models in [src/models.py](src/models.py)
2. If using migrations: `alembic revision --autogenerate -m "description"` then `alembic upgrade head`
3. For development: `python src/scripts/load_clientes_maestro.py` (drops and recreates tables, reloads client data)
4. Note: `load_clientes_maestro.py` calls `Base.metadata.drop_all()` and `create_all()` internally

### Frontend Component Development
- All pages are in [dashboard/app/](dashboard/app/) (Next.js App Router structure)
- Shared components in [dashboard/components/](dashboard/components/)
- Use `'use client'` directive for components with hooks (useState, useSWR, useEffect)
- Import shared types from `@/lib/types`
- Import API client from `@/lib/api`
- Use Lucide React for icons: `import { IconName } from 'lucide-react'`
- Use date-fns for date formatting: `format(date, "d MMM yyyy", { locale: es })`

### Adding New Map Provinces
To add coordinates for a new province in [dashboard/components/SpainMapLeaflet.tsx](dashboard/components/SpainMapLeaflet.tsx):
```typescript
const PROVINCE_COORDINATES: Record<string, [number, number]> = {
  'Province Name': [latitude, longitude],
  // Example: 'Madrid': [40.4168, -3.7038]
};
```

### Client Status Logic (Important!)
When working with client status classification:
```typescript
// Filter for VALID sessions only
// Valid session = is_client_meeting=true (includes CONFIRMED and PROBABLE)
const validSessions = appointments.filter(apt =>
  apt.is_client_meeting &&
  apt.matched_client_id
);

// Apply analyst filter only (NO date filters)
const filteredValidSessions = validSessions.filter(apt => {
  const analystMatch = selectedAnalyst === 'all' || apt.analyst_email === selectedAnalyst;
  return analystMatch;
});

// Calculate days since last valid session from TODAY
const today = new Date();
const lastSession = validSessions[0]; // assuming sorted by date desc
const daysSince = lastSession ? differenceInDays(today, new Date(lastSession.start_time)) : 999;

// Determine status (ALWAYS from today)
let status: 'OK' | 'ATTENTION' | 'CRITICAL';
if (daysSince <= 30) status = 'OK';
else if (daysSince <= 60) status = 'ATTENTION';
else status = 'CRITICAL';
```

**Important Notes**:
- We include PROBABLE matches because clients may attend meetings even if they don't confirm attendance in the calendar
- **Date filters are NOT used in Clientes module** - status is ALWAYS calculated from current date (TODAY)
- This avoids confusion where filtering by old months would show all clients as CRITICAL
- The Clientes module shows real-time portfolio health, not historical analysis
- For historical analysis with date filters, use the Reuniones or Mapa modules

## Windows-Specific Notes

This project is developed on Windows:
- Use backslashes or forward slashes in paths (both work)
- [start_dev.bat](start_dev.bat) sets PATH and spawns CMD windows for backend/frontend
- PostgreSQL runs on port 5432 with user `postgres` and password `dentaldata`

### Connecting to Cloud SQL via DBeaver (or any external client)

Cloud SQL does NOT expose a public TCP port. All external connections (local dev, DBeaver, teammates) require **cloud-sql-proxy** running locally.

**Step 1: Start the proxy** (keep running in a terminal):
```bash
# Option A — using start_proxy.bat (recommended)
start_proxy.bat

# Option B — manual command (if cloud-sql-proxy.exe is not in project root)
cloud-sql-proxy.exe seguimientoclientes-483013:europe-southwest1:dentaldata-db --port 5433
```

**Step 2: Configure DBeaver**:
- Host: `127.0.0.1`
- Port: `5433`
- Database: `dentaldata`
- User: `postgres`
- Password: `dentaldata`

**Teammates**: They need the same setup:
1. Install [gcloud CLI](https://cloud.google.com/sdk/docs/install) and run `gcloud auth application-default login`
2. Download `cloud-sql-proxy.exe` to their machine
3. Run the proxy command above
4. Connect DBeaver to `127.0.0.1:5433`

The proxy always required — there is no way to connect directly to Cloud SQL without it.

### Managing Running Services

To stop running services:

```bash
# Find processes using specific ports
netstat -ano | findstr :8000  # Backend
netstat -ano | findstr :3000  # Frontend

# Kill specific process by PID
taskkill /PID <process_id> /F

# Or kill all Node/Python processes (⚠️ use with caution)
taskkill /IM node.exe /F
taskkill /IM python.exe /F
```

## Current Status & Working Features

**Production**: ✅ Fully deployed and working on Google Cloud Run (June 2026).
**CI/CD**: GitHub Actions deploys to Cloud Run automatically on push to `master`.

### ✅ Backend Features
- Client database loaded from [clientes_maestro.json](clientes_maestro.json) (160 clients, 200+ emails)
- FastAPI backend with all endpoints functional
- **Improved matching algorithm** with word-boundary detection (prevents "antia" ↔ "garantia" confusion)
- Personal event detection (filters casa, comida, llamar, etc.)
- Internal meeting detection (filters out @dentaldata.es-only meetings)
- **Fuzzy matching disabled** for higher precision
- **Automatic clinic synchronization** for 6 multi-location clinic groups (17 clinics total)
- Google Calendar integration with OAuth token (preferred) and Service Account fallback
- PostgreSQL (Cloud SQL) with proper relationships
- **ETL endpoint** (`POST /etl/run`): synchronous, parallel fetch, bulk upsert — ~89s in production

### ✅ Frontend Features
- **Overview Dashboard**: Real-time metrics, analyst performance, status distribution
- **Clientes Module**: Product Designer-specified interface with:
  - Valid session business logic (is_client_meeting=true, includes CONFIRMED and PROBABLE)
  - Client status classification (OK/ATTENTION/CRITICAL)
  - Status-oriented cards with click-to-filter
  - Search functionality
  - Priority sorting (CRITICAL first)
  - Unified table with action buttons
- **Reuniones Module**: Full appointment list with filters
- **Mapa Module**: Interactive Leaflet map with:
  - Real Spain map with CARTO Voyager tiles
  - 70+ province coordinates
  - Vibrant color gradient based on concentration
  - Click provinces to view client details
  - Tooltips with meeting/client counts
- **Auto-refresh**: All data refreshes every 30 seconds via SWR
- **Sincronizar button** ([dashboard/components/SyncButton.tsx](dashboard/components/SyncButton.tsx)): triggers ETL, shows elapsed timer, 600s timeout
- **Responsive Design**: Mobile-friendly with Tailwind CSS
- **Dark Theme**: DD corporate design system (`data-theme="dark"` on `<html>`)

### 🎨 Design System (DD Corporate — January 2026)

The frontend was fully migrated to the **DD design system** (`dd_design/`). Do NOT use the old slate/Tailwind v3 dark theme.

- **Theme activation**: `data-theme="dark"` on `<html>` — NOT `className="dark"`
- **Token source**: `dashboard/dd/theme.css` (copy of `dd_design/theme.css`)
- **Component library**: `dashboard/dd/components/` — 21 components (Button, Badge, Card, Alert, Modal, Table, etc.)
- **Colors** (use CSS tokens, never hardcode slate):
  - `bg-canvas` (#0D0D0C) — page background
  - `bg-surface` (#181816) — cards and panels
  - `border-line` — default borders
  - `text-fg` / `text-fg-muted` / `text-fg-subtle` — text hierarchy
  - `text-boss-primary` / `bg-boss-primary` — brand purple (#4507cc)
  - `text-accent` / `bg-accent` — orange (#E85420)
  - `text-success` / `bg-success` — green
  - `text-danger-fg` / `bg-danger-tint` — red
- **Typography**:
  - `font-display` → Syne (headings, metrics)
  - `font-body` → DM Sans (default body)
  - `font-mono` → JetBrains Mono (code)
  - Loaded via Google Fonts in `dashboard/app/layout.tsx`
- **Icons**: Material Symbols Outlined — `<span className="material-symbols-outlined">icon_name</span>`
  - lucide-react is **removed** from the project
  - Icons are loaded via Google Fonts link in layout.tsx
- **Charts**: Recharts with **hardcoded hex colors** — Recharts does NOT read CSS variables
- **Corner radius**: square/minimal — no `rounded-xl`, use `rounded-sm` at most
- **Spacing**: consistent `p-5` / `p-4` cards, `gap-4` / `gap-5` grids

### 📊 Key Metrics Tracked
1. **Total Clients**: All clients in database
2. **Clients with Valid Sessions**: Clients with CONFIRMED meetings
3. **OK Clients**: Valid session ≤30 days ago
4. **ATTENTION Clients**: Valid session 31-60 days ago
5. **CRITICAL Clients**: Valid session >60 days ago or none
6. **Match Status Distribution**: CONFIRMED, PROBABLE, NO_MATCH, INTERNAL counts
7. **Provincial Distribution**: Meetings and clients by province

### 🔄 Data Flow Summary
```
Google Calendar (luis@dentaldata.es)
  ↓ (ETL: src/etl.py)
PostgreSQL (clients, client_emails, appointments)
  ↓ (API: src/main.py)
Next.js Dashboard (4 views: Overview, Clientes, Reuniones, Mapa)
  ↓ (SWR: 30s auto-refresh)
Real-time visualization with filters
```

## Known Issues & Limitations

### ⚠️ Current Limitations
- Action buttons (Calendar, Clock) in Clientes module are placeholders (not yet functional)
- No date range picker (uses FilterBar month selector only)
- No data export functionality (CSV/Excel)
- Map coordinates are approximate (capital cities, may not be exact)
- No pagination on large datasets (uses limit=1000 on appointments)

### 🐛 Potential Issues
- If backend port changes, update [dashboard/lib/api.ts](dashboard/lib/api.ts) baseURL
- Leaflet requires client-side rendering (uses `dynamic` import with `ssr: false`)
- Large datasets may cause performance issues (consider pagination)
- Google Calendar API rate limits may affect ETL frequency

## Future Enhancements (Backlog)

### Priority 0 (Critical Performance & Architecture)
- **⚠️ CRITICAL: Implement incremental sync for client data** - Current `load_clientes_maestro.py` drops and recreates ALL tables on every execution (lines 32-36), which is **extremely inefficient and dangerous in production**:
  - **Problem**: Adding 1 new client = deleting and recreating 154 clients + 200+ emails + 3,360+ appointments
  - **Risk**: Data loss if script fails midway, no rollback mechanism
  - **Solution**: Implement **upsert (INSERT ... ON CONFLICT UPDATE)** logic:
    1. Compare `clientes_maestro.json` hash/timestamp with cache to detect changes
    2. Only process changed/new records using SQLAlchemy's `merge()` or raw SQL `ON CONFLICT`
    3. For emails: compare existing vs new, delete orphaned, insert new
    4. Preserve `appointments` table completely (never drop it)
  - **Cache Layer (Valkey/Redis)** - Implement distributed cache for:
    - Client data lookup (reduce DB queries in matching)
    - Email-to-client mapping (currently built on every ETL run)
    - Calendar event deduplication (avoid re-processing same events)
    - ETL execution metadata (last sync timestamp, processed event IDs)
    - Cache invalidation strategy: TTL 1 hour + manual invalidation on client updates
  - **Migration Strategy**:
    1. Create new script `src/scripts/sync_clientes_maestro.py` with upsert logic
    2. Keep old `load_clientes_maestro.py` only for initial setup/disaster recovery
    3. Add Valkey container to `docker-compose.yml`
    4. Update ETL to use Valkey for email mapping cache
    5. Add API endpoint `/cache/invalidate` for manual cache refresh
  - **Estimated Impact**:
    - Reduce client update time from ~30s to <1s
    - Eliminate risk of data loss during updates
    - Reduce ETL execution time by 60-80% with cached lookups
    - Enable safe production deployments without data recreation

### Priority 1 (High Value)
- Implement "Agendar reunión" (Schedule meeting) button functionality
- Implement "Ver historial" (View history) modal with full client meeting timeline
- Add data export to Excel/CSV
- Add date range picker for custom periods

### Priority 2 (Nice to Have)
- Email notifications for CRITICAL clients
- Batch operations (bulk assign, bulk email)
- Advanced search with filters (by programa, provincia, status)
- Sortable table columns
- Pagination for large datasets
- Client detail page with full contact info and meeting history

### Priority 3 (Polish)
- Skeleton loaders for better loading UX
- Better animations and transitions
- Print-friendly views
- Mobile app (React Native)
- Real-time WebSocket updates instead of polling

## ✅ Google Cloud Run — Production Status (June 2026)

**Status**: Production is **FULLY WORKING**. All critical issues resolved.

### Current Production State

| Service | URL | Status |
|---------|-----|--------|
| Backend | https://dentaldata-backend-243744598910.us-central1.run.app | ✅ Running |
| Frontend | https://dentaldata-frontend-243744598910.us-central1.run.app | ✅ Running |
| Cloud SQL | europe-southwest1:dentaldata-db | ✅ Connected |

**Last verified metrics** (after Sincronizar): 160 clients — 131 OK / 17 Pendientes / 12 Críticos.

### How to Sync Data (ETL)

The **Sincronizar** button in the frontend header triggers the ETL. It runs synchronously and takes ~89s. A live elapsed timer is displayed while running.

To trigger manually:
```bash
curl -X POST https://dentaldata-backend-243744598910.us-central1.run.app/etl/run
```

### Known GCR-Specific Notes

**Database Connection**:
- Uses Cloud SQL Unix socket (not TCP): `postgresql+pg8000://postgres:dentaldata@/dentaldata?unix_sock=/cloudsql/seguimientoclientes-483013:europe-southwest1:dentaldata-db/.s.PGSQL.5432`
- Requires `--set-cloudsql-instances` flag in deploy command
- Database is in `europe-southwest1` region (not us-central1 where services run) — ~100ms cross-region latency per round-trip

**Secrets Management** (Secret Manager):
| Secret | Path mounted | Purpose |
|--------|-------------|---------|
| `google-credentials` | `/secrets/credentials.json` | GCal Service Account |
| `google-oauth-token` | `/token/token.pickle` | GCal OAuth token (preferred auth) |
| `dentaldata-db-url` | `DATABASE_URL` env var | PostgreSQL connection string |

- Secrets in `/secrets/` and `/token/` are read-only. `token.pickle` refresh fails to write to disk but works in-memory — the occasional log warning is harmless.
- **Never** mount secrets to `/app/` — it overwrites the application code.

**CORS**: `FRONTEND_URL` env var controls allowed origins. Set via `.env.yaml`.

**Deployment**: Automatic via GitHub Actions on push to `master`. See [.github/workflows/ci.yml](.github/workflows/ci.yml).

### Future GCR Improvements (Post-MVP)

1. **Automatic ETL Scheduling** — Cloud Scheduler triggering `/etl/run` daily (currently manual via button)
2. **Performance** — N+1 query in `/clients/with-meetings` (mitigated by 60s frontend timeout)
3. **Monitoring** — Cloud Logging dashboards, error alerting for failed ETL runs

## Troubleshooting

### Backend won't start
```bash
# Check PostgreSQL is running
docker ps | grep dentaldata-db

# Check backend logs
docker logs dentaldata-backend

# Restart backend
docker restart dentaldata-backend

# Check .env file exists with correct DATABASE_URL
cat .env
```

### Frontend won't compile
```bash
cd dashboard
rm -rf .next node_modules package-lock.json
npm install
npm run dev
```

### Map not showing
- Check browser console for Leaflet errors
- Verify `leaflet/dist/leaflet.css` is imported in [dashboard/app/layout.tsx](dashboard/app/layout.tsx)
- Ensure component uses `dynamic` import with `ssr: false`

### No data showing
- Run ETL: `docker exec dentaldata-backend python src/etl.py`
- Check backend logs: `docker logs dentaldata-backend`
- Check network tab in browser DevTools
- Verify backend is running: `curl http://localhost:8001/`

### New Client Not Appearing in Dashboard (COMMON ISSUE)

**Symptom**: Added new client to `clientes_maestro.json`, ran ETL, but client doesn't appear in dashboard or events show `NO_MATCH` status.

**Root Cause**: Incorrect execution order - ETL was run BEFORE the client was loaded into the database.

**Solution** (Updated January 6, 2026):
```bash
# Step 1: Load clients to database (this drops and recreates ALL tables)
docker exec dentaldata-backend python src/scripts/load_clientes_maestro.py

# Step 2: Run ETL to process calendar events (NO RESTART NEEDED!)
docker exec dentaldata-backend python src/etl.py

# Step 4: Verify the client exists
curl "http://localhost:8001/clients?limit=200" | grep "DD-00130"

# Step 5: Verify the appointment was matched
docker exec dentaldata-backend python3 -c "
from sqlalchemy import create_engine, text
from src.config import DATABASE_URL
engine = create_engine(DATABASE_URL)
conn = engine.connect()
result = conn.execute(text(
    \"SELECT id, summary, match_status, matched_client_id, match_confidence
     FROM appointments
     WHERE matched_client_id = 'DD-00130'\"
)).fetchall()
print(f'Found {len(result)} appointments for DD-00130')
for r in result:
    print(f'  {r[1][:50]}... → {r[2]} ({r[4]*100}%)')
conn.close()
"
```

**Diagnostic Commands**:
```bash
# Check if client is in database
docker exec dentaldata-backend python3 -c "
from sqlalchemy import create_engine, text
from src.config import DATABASE_URL
engine = create_engine(DATABASE_URL)
conn = engine.connect()
result = conn.execute(text(\"SELECT id, name FROM clients WHERE id = 'DD-00130'\")).fetchone()
print(f'Client found: {result is not None}')
if result:
    print(f'  ID: {result[0]}, Name: {result[1]}')
conn.close()
"

# Check ETL logs for the event
cat logs/etl.log | grep -i "hondarribia" | tail -10

# Expected output (GOOD):
# Match: CONFIRMED → Hondarribia Klinika (100%)

# Bad output (indicates client wasn't in DB when ETL ran):
# Match: NO_MATCH
```

**Key Points**:
1. **Order matters**: Load clients → Restart backend → Run ETL
2. **Backend caches data**: Must restart after loading clients
3. **ETL can't match what doesn't exist**: If client isn't in DB, matching fails
4. **Check logs**: `logs/etl.log` shows matching results for each event
5. **Verify database directly**: Use SQL queries to confirm data is present

**Prevention**: Create a wrapper script that enforces correct order:
```bash
#!/bin/bash
# add_new_client.sh
echo "Step 1: Loading clients..."
docker exec dentaldata-backend python src/scripts/load_clientes_maestro.py

echo "Step 2: Restarting backend..."
docker restart dentaldata-backend
sleep 20

echo "Step 3: Running ETL..."
docker exec dentaldata-backend python src/etl.py

echo "Done! Check dashboard at http://localhost:3000/clientes"
```

## Recent Improvements (December 27-28, 2025)

### Matching Algorithm Enhancements
1. **Word-Boundary Matching** - Added `_word_match()` function using regex `\b` to prevent substring false positives
2. **Fuzzy Matching Disabled** - Removed fuzzy matching to eliminate false positives like "garantia" → "antia"
3. **Personal Event Detection** - Added keyword filtering for personal calendar events (casa, comida, llamar, etc.)

### Client Data Corrections
1. **Deltell Clinics** - Separated two distinct clinics (deltell elche vs deltell gonzalez)
2. **Contreras Duplicate** - Merged CLI_00010 into CLI_00023
3. **Patins Duplicate** - Merged CLI_00101 into CLI_00038
4. **Perez vs Antia Dental** - Separated two distinct "Perez" clinics:
   - CLI_00067: perez (José Pérez González, Huelva)
   - CLI_00108: antia dental (Cristina Pérez Garnelo, Pontevedra)
   - Added `cristinapgarnelo@gmail.com` to Antia Dental for automatic matching
5. **Garantía Mismatches** - Corrected 6+ appointments incorrectly assigned to Antia due to fuzzy matching

### ETL Synchronization Additions
Implemented automatic appointment synchronization for 6 clinic groups:
1. Amelar (2 clinics)
2. Junyent (2 clinics)
3. Almidental (2 clinics)
4. Smilodon (2 clinics)
5. Garantía Dental (2 clinics)
6. **Elite (7 clinics)** - Largest sync group with 27 shared appointments

Total: **17 clinics** automatically synchronized, ensuring all locations show identical last session dates.

### Bug Fixes
- Fixed substring matching bug where "antia dental" matched "garantia dental"
- Fixed "Perez" meetings incorrectly assigned to wrong clinic
- Corrected appointment count discrepancies after synchronization

### January 5, 2026 - New Client Addition Process Bug & Fix

**Issue Discovered**: Added new client "Hondarribia Klinika" (DD-00130) but it didn't appear in dashboard.

**Root Cause Analysis**:
1. Client was added to `clientes_maestro.json` correctly
2. Event existed in Google Calendar (Jan 9, 2026): "Hondarribia Klinika- Maialen y Ernesto Toledo- Reunión Auditoría..."
3. Email `hondarribiaklinika@gmail.com` was registered
4. **PROBLEM**: ETL was executed BEFORE `load_clientes_maestro.py`, so client didn't exist during matching
5. Result: Event got `NO_MATCH` status instead of `CONFIRMED`

**Solution Implemented**:
1. Documented correct execution order in "Adding New Clients Workflow" section
2. Added "New Client Not Appearing in Dashboard" troubleshooting guide with diagnostic commands
3. Emphasized **CRITICAL** backend restart step (required to reload in-memory cache)
4. Created verification queries to check database state

**Correct Process** (now documented):
```bash
# 1. Load clients (drops all tables, recreates from JSON)
docker exec dentaldata-backend python src/scripts/load_clientes_maestro.py

# 2. Restart backend (reload cache) - CRITICAL!
docker restart dentaldata-backend && sleep 20

# 3. Run ETL (match calendar events to clients)
docker exec dentaldata-backend python src/etl.py
```

**Verification After Fix**:
- ✅ Client DD-00130 loaded: "Hondarribia Klinika"
- ✅ Email registered: `hondarribiaklinika@gmail.com`
- ✅ Event matched: `CONFIRMED → Hondarribia Klinika (100%)`
- ✅ Appointment saved: ID `611selpd6idgad9421oqg4fof0`, date: Jan 9 2026
- ✅ Visible in dashboard: http://localhost:3000/clientes

**Files Updated**:
- [CLAUDE.md](CLAUDE.md): Added comprehensive "New Client Not Appearing" troubleshooting section
- [CLAUDE.md](CLAUDE.md): Updated "Adding New Clients Workflow" with correct Docker execution order
- [clientes_maestro.json](clientes_maestro.json): Added DD-00130 (Hondarribia Klinika)

**Key Learnings**:
1. **Order is critical**: Load clients → Restart backend → Run ETL (NOT ETL → Load)
2. **Backend caches clients in memory**: Must restart to see new data in API
3. **ETL logs are diagnostic gold**: Check `logs/etl.log` for match results per event
4. **Database ≠ API**: Database can have data that API doesn't serve until backend restart
5. **Common mistake**: Running ETL first seems logical but causes silent failures

---

## Google Cloud Run Deployment Guide (January 6, 2026)

### Deployment History

After **10+ failed deployment attempts**, the application was successfully deployed to Google Cloud Run on January 6, 2026. This section documents all the challenges encountered and solutions implemented.

### Critical Issues Resolved

#### 1. HEALTHCHECK Incompatibility (Attempt #1-3)

**Problem**: Backend container failed to start with error:
```
Container failed to start and listen on the port defined by PORT=8080 within the allocated timeout
```

**Root Cause**:
- Dockerfile HEALTHCHECK pointed to hardcoded port 8000
- Cloud Run assigns dynamic ports (8080+)
- Cloud Run's health check system conflicted with Dockerfile HEALTHCHECK

**Solution**:
- Removed HEALTHCHECK from both [Dockerfile](Dockerfile) and [dashboard/Dockerfile](dashboard/Dockerfile)
- Cloud Run has its own built-in health check system that automatically monitors containers
- Changed CMD to use dynamic PORT: `python -m uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000}`

**Files Modified**:
- `Dockerfile` (lines 158-180 removed)
- `dashboard/Dockerfile` (lines 235-254 removed)

#### 2. OAuth Token Refresh in Read-Only Environment (Attempt #4-5)

**Problem**: Backend couldn't refresh Google Calendar OAuth tokens because Cloud Run mounts secrets as read-only.

**Root Cause**:
- `gcal.py` tried to write updated `token.pickle` to `/app/` directory
- Cloud Run containers are ephemeral and secret mounts are read-only

**Solution**:
- Migrated to **Service Account** authentication (no token refresh needed)
- Updated [src/services/gcal.py](src/services/gcal.py) to prioritize Service Account over OAuth
- Configured Domain-Wide Delegation in Google Workspace for Service Account impersonation

**Files Modified**:
- `src/services/gcal.py` (lines 50-80)

#### 3. Secret Mount Path Hiding /app Directory (Attempt #6)

**Problem**: `ModuleNotFoundError: No module named 'src'` despite PYTHONPATH configuration.

**Root Cause**:
- Mounting secret to `/app/credentials.json` **overwrote the entire /app directory**
- This is a Docker volume mount behavior - mounting a file to a directory replaces the directory

**Solution**:
- Changed secret mount path from `/app/credentials.json` to `/secrets/credentials.json`
- Updated `GOOGLE_CREDENTIALS_PATH` in `.env.yaml` to `/secrets/credentials.json`

**Deploy Command Updated**:
```bash
--set-secrets="/secrets/credentials.json=google-credentials:latest"
```

#### 4. Wrong Cloud SQL Region (Attempt #7)

**Problem**: `ConnectionRefusedError: [Errno 111] Connection refused` on Unix socket.

**Root Cause**:
- DATABASE_URL used wrong region: `us-central1` instead of `europe-southwest1`
- Cloud SQL instance was in `europe-southwest1`

**Solution**:
- Updated DATABASE_URL secret in Secret Manager:
```
postgresql+pg8000://postgres:dentaldata@/dentaldata?unix_sock=/cloudsql/seguimientoclientes-483013:europe-southwest1:dentaldata-db/.s.PGSQL.5432
```

#### 5. NEXT_PUBLIC_API_URL Not Injected in Frontend (Attempts #8-10)

**Problem**: Frontend showed "0 clientes" despite backend working correctly. Console showed:
```
API Base URL: 656c3028a9652688.7sj1  (corrupted hash instead of URL)
API No Response: Backend no responde. ¿Está corriendo?
```

**Root Cause**:
- Next.js requires `NEXT_PUBLIC_*` variables available **during build time** (`npm run build`)
- Using `--set-env-vars` passes variables to runtime, not build time
- Using `--set-build-env-vars` doesn't work with ARG in Dockerfile
- The JavaScript was compiled with `undefined` value, causing it to use the chunk hash as fallback

**Failed Solutions**:
1. Created `.env.production` file - ❌ Not included in Cloud Build
2. Added `ENV NEXT_PUBLIC_API_URL` to Dockerfile - ❌ ENV not available to client-side code in Next.js
3. Used `ARG + ENV` pattern with `--set-build-env-vars` - ❌ Cloud Build doesn't pass build-env-vars to Dockerfile ARG

**Final Solution**:
- Hardcoded `ENV NEXT_PUBLIC_API_URL` directly in [dashboard/Dockerfile](dashboard/Dockerfile:53)
```dockerfile
ENV NEXT_PUBLIC_API_URL=https://dentaldata-backend-243744598910.us-central1.run.app
```

**Files Modified**:
- `dashboard/Dockerfile` (line 53)
- `dashboard/lib/api.ts` (line 37: increased timeout from 30s to 60s)

#### 6. Backend Performance - N+1 Query Problem

**Problem**:
- Endpoint `/clients/with-meetings` taking **48 seconds** to respond
- Frontend timeout of 30 seconds causing "API No Response" errors

**Root Cause**:
- Classic N+1 query problem in [src/main.py](src/main.py:145-180)
- For each of 125 clients, backend made a separate database query to count meetings:
```python
for client in clients:
    meeting_count = db.query(func.count(...)).filter(...).scalar()  # 125 individual queries!
```

**Solution**:
- **Immediate Fix**: Increased frontend timeout from 30s to 60s in [dashboard/lib/api.ts](dashboard/lib/api.ts:37)
- **Pending Optimization**: Rewrite query to use single JOIN with GROUP BY (see "Outstanding Issues" below)

**Performance Impact**:
- Current: 48 seconds for 125 clients (unacceptable)
- Expected after optimization: <2 seconds (single aggregated query)

### Deployment Configuration Files

#### Backend Deploy Command
```bash
gcloud run deploy dentaldata-backend \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-cloudsql-instances=seguimientoclientes-483013:europe-southwest1:dentaldata-db \
  --set-secrets="DATABASE_URL=dentaldata-db-url:latest,/secrets/credentials.json=google-credentials:latest" \
  --env-vars-file=.env.yaml \
  --memory=512Mi \
  --cpu=1 \
  --timeout=300 \
  --max-instances=10 \
  --min-instances=0 \
  --no-use-http2
```

#### Frontend Deploy Command
```bash
cd dashboard
gcloud run deploy dentaldata-frontend \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory=512Mi \
  --cpu=1 \
  --timeout=60 \
  --max-instances=5 \
  --min-instances=0 \
  --no-use-http2
```

#### .env.yaml (Backend Environment Variables)
```yaml
IMPERSONATE_EMAIL: "luis@dentaldata.es"
ANALYST_EMAILS: "u.barroso@dentaldata.es,m.val@dentaldata.es,c.bosom@dentaldata.es"
PYTHONPATH: "/app"
GOOGLE_CREDENTIALS_PATH: "/secrets/credentials.json"
```

### CORS Configuration

Backend [src/main.py](src/main.py:30-45) configured to accept requests from frontend:
```python
FRONTEND_URL = os.getenv("FRONTEND_URL", "")
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if FRONTEND_URL:
    allowed_origins.append(FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Set `FRONTEND_URL` when deploying backend:
```bash
gcloud run services update dentaldata-backend \
  --region us-central1 \
  --update-env-vars="FRONTEND_URL=https://dentaldata-frontend-243744598910.us-central1.run.app"
```

### Secret Manager Configuration

**Required Secrets**:
1. `dentaldata-db-url` - PostgreSQL connection string with Cloud SQL Unix socket
2. `google-credentials` - Service Account JSON for Google Calendar API

**Create Secrets**:
```bash
# Database URL
echo "postgresql+pg8000://postgres:dentaldata@/dentaldata?unix_sock=/cloudsql/seguimientoclientes-483013:europe-southwest1:dentaldata-db/.s.PGSQL.5432" | \
  gcloud secrets create dentaldata-db-url --data-file=-

# Google Credentials (upload credentials.json file)
gcloud secrets create google-credentials --data-file=credentials.json
```

### Cloud SQL Configuration

**Instance Details**:
- Instance ID: `dentaldata-db`
- Region: `europe-southwest1`
- Database: `dentaldata`
- User: `postgres`
- Connection: Unix socket (not TCP)

**Connection String Format**:
```
postgresql+pg8000://[USER]:[PASSWORD]@/[DATABASE]?unix_sock=/cloudsql/[PROJECT]:[REGION]:[INSTANCE]/.s.PGSQL.5432
```

**Important**: Use `pg8000` driver (not `psycopg2`) for Cloud SQL Unix socket connections.

### Outstanding Issues & Next Steps

#### ⚠️ CRITICAL: Backend Performance Optimization Required

**Problem**: `/clients/with-meetings` endpoint takes 48 seconds (N+1 query problem)

**Current Workaround**: Frontend timeout increased to 60 seconds

**Permanent Solution** (Ready to deploy - see [src/main.py](src/main.py:145-194)):
```python
# Optimized version with single JOIN query
query = (
    db.query(
        ClientModel.id,
        ClientModel.name,
        ClientModel.nombre_contacto,
        ClientModel.programa,
        ClientModel.provincia,
        func.count(AppointmentModel.id).label('meeting_count')
    )
    .join(AppointmentModel, ClientModel.id == AppointmentModel.matched_client_id)
    .filter(AppointmentModel.match_status.in_(['CONFIRMED', 'PROBABLE']))
    .group_by(ClientModel.id, ClientModel.name, ClientModel.nombre_contacto,
              ClientModel.programa, ClientModel.provincia)
)
```

**Deployment Blocked By**: ZIP timestamp error when deploying backend
```
ERROR: gcloud crashed (ValueError): ZIP does not support timestamps before 1980
```

**Temporary Workaround**: Frontend works with 60s timeout, but user experience is poor (long loading times)

**Next Action Required**:
1. Find and fix files with timestamps before 1980 (likely in `dashboard/node_modules/` or `logs/`)
2. Update `.gcloudignore` to exclude problematic files
3. Deploy optimized backend code
4. Reduce frontend timeout back to 30s once backend is fast

#### Other Deployment Notes

**Browser Cache Issues**:
- Users must do **hard refresh** (Ctrl+Shift+R) after deployments
- Next.js caches compiled JavaScript aggressively
- Consider adding cache-busting version numbers in production

**Build Time Considerations**:
- Backend build: ~3-4 minutes
- Frontend build: ~5-6 minutes
- Total deployment time: ~10 minutes per service

**Cost Optimization**:
- Both services scale to zero when not in use
- Cloud SQL instance runs continuously (consider stopping for development)
- Estimated monthly cost: ~$30-50 USD (mostly Cloud SQL)

---

**Last Updated**: January 6, 2026
**Version**: 3.0 (After successful Google Cloud Run deployment with performance workarounds)

**Total Appointments**: ~3,176 events processed (1,218 matched to clients)
**Total Clients**: 130 (using DD-XXXXX ID format)
**Total Emails**: 166 registered
**Synchronized Clinics**: 17 (6 groups)

**Critical Notes**:
- ⚠️ Current client loading process (`load_clientes_maestro.py`) drops ALL tables - **NOT production-safe**
- ⚠️ Backend restart REQUIRED after loading clients (cache invalidation issue)
- See "Priority 0" for incremental sync + Valkey cache implementation plan
- Estimated performance gain: 60-80% reduction in ETL time, <1s client updates vs current ~30s full reload
