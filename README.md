# Seguimiento Clientes - Dental Data

Sistema de seguimiento y análisis de reuniones de analistas con clientes de Dental Data. Integra Google Calendar con una base de datos de clientes para generar métricas y visualizaciones en tiempo real.

## Descripción

**Seguimiento Clientes** es una herramienta interna que automatiza el tracking de reuniones con clientes, proporcionando un dashboard interactivo con análisis de actividad, estado de la cartera de clientes y métricas de rendimiento por analista.

### Características Principales

- **Sincronización automática con Google Calendar**: Extrae eventos de calendarios de analistas
- **Matching inteligente cliente-reunión**: Identifica automáticamente qué reuniones corresponden a cada cliente
- **Dashboard interactivo**: Visualizaciones en tiempo real con Next.js
- **Clasificación de clientes por estado**: OK, ATENCIÓN, CRÍTICO según última sesión
- **Mapa provincial**: Visualización geográfica de la concentración de reuniones
- **Auto-actualización**: Datos se refrescan cada 30 segundos

## Arquitectura

### Backend (FastAPI + PostgreSQL)

- **Framework**: FastAPI con Python 3.10+
- **Base de datos**: PostgreSQL con SQLAlchemy ORM
- **Integración**: Google Calendar API
- **Puerto**: 8000

**Componentes principales**:
- `src/main.py` - API REST con endpoints de consulta
- `src/etl.py` - Proceso ETL para sincronización de calendarios
- `src/services/gcal.py` - Cliente de Google Calendar
- `src/services/matching.py` - Algoritmo de matching cliente-reunión
- `src/models.py` - Modelos de base de datos
- `src/schemas.py` - Schemas de validación Pydantic

### Frontend (Next.js 15)

- **Framework**: Next.js 15 con React 19 y TypeScript
- **Estilo**: Tailwind CSS v4
- **Mapas**: Leaflet con tiles CARTO Voyager
- **Data fetching**: SWR con polling de 30s
- **Puerto**: 3000

**Módulos principales**:
- **Overview** (`app/page.tsx`) - Dashboard principal con métricas generales
- **Clientes** (`app/clientes/page.tsx`) - Gestión de cartera con clasificación por estado
- **Reuniones** (`app/reuniones/page.tsx`) - Lista completa de eventos
- **Mapa** (`app/mapa/page.tsx`) - Visualización provincial interactiva

## Instalación

### Requisitos Previos

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- Google Cloud Project con Calendar API habilitada

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd "Seguimiento Clientes"
```

### 2. Configurar Backend

```bash
# Instalar dependencias de Python
pip install -r requirements.txt

# Crear base de datos PostgreSQL
createdb -U postgres dentaldata

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales
```

**Archivo `.env` requerido**:
```env
DATABASE_URL=postgresql+pg8000://postgres:password@localhost:5432/dentaldata
GOOGLE_CREDENTIALS_PATH=credentials.json
ANALYST_EMAILS=analyst1@dentaldata.es,analyst2@dentaldata.es,analyst3@dentaldata.es
IMPERSONATE_EMAIL=luis@dentaldata.es
```

### 3. Configurar Google Calendar API

1. Crear proyecto en [Google Cloud Console](https://console.cloud.google.com)
2. Habilitar Google Calendar API
3. Crear credenciales OAuth 2.0 o Service Account
4. Descargar como `credentials.json` en el directorio raíz

### 4. Cargar datos iniciales

```bash
# Inicializar tablas
python src/scripts/init_db.py

# Cargar clientes desde clientes_maestro.json
python src/scripts/load_clientes_maestro.py

# Ejecutar ETL inicial
python src/etl.py
```

### 5. Configurar Frontend

```bash
cd dashboard

# Instalar dependencias
npm install

# Verificar configuración de API
# Editar dashboard/lib/api.ts si es necesario (por defecto apunta a http://127.0.0.1:8000)
```

## Uso

### Desarrollo

**Opción 1: Inicio automático (Windows)**
```bash
start_dev.bat
```

**Opción 2: Inicio manual**

Terminal 1 - Backend:
```bash
python -m uvicorn src.main:app --host 127.0.0.1 --port 8000 --reload
```

Terminal 2 - Frontend:
```bash
cd dashboard
npm run dev
```

Acceder a:
- Frontend: http://localhost:3000
- API Backend: http://127.0.0.1:8000
- Documentación API: http://127.0.0.1:8000/docs

### Producción

Ver [CLAUDE.md](CLAUDE.md) para instrucciones detalladas de deployment en Azure.

## Comandos Útiles

### Backend

```bash
# Verificar contenido de la base de datos
python src/scripts/check_db.py

# Exportar base de datos a JSON
python src/scripts/export_db_to_json.py

# Ejecutar ETL manualmente
python src/etl.py
```

### Frontend

```bash
cd dashboard

# Desarrollo
npm run dev

# Build de producción
npm run build

# Iniciar servidor de producción
npm start

# Linting
npm run lint
```

## Estructura del Proyecto

```
Seguimiento Clientes/
├── src/                          # Backend Python
│   ├── main.py                   # API FastAPI
│   ├── etl.py                    # Proceso ETL
│   ├── config.py                 # Configuración
│   ├── database.py               # Conexión a PostgreSQL
│   ├── models.py                 # Modelos SQLAlchemy
│   ├── schemas.py                # Schemas Pydantic
│   ├── services/
│   │   ├── gcal.py              # Google Calendar client
│   │   └── matching.py          # Algoritmo de matching
│   └── scripts/
│       ├── init_db.py           # Inicializar BD
│       ├── load_clientes_maestro.py  # Cargar clientes
│       ├── check_db.py          # Verificar BD
│       └── export_db_to_json.py # Exportar BD
├── dashboard/                    # Frontend Next.js
│   ├── app/                     # Páginas (App Router)
│   │   ├── page.tsx            # Overview
│   │   ├── clientes/           # Módulo clientes
│   │   ├── reuniones/          # Módulo reuniones
│   │   └── mapa/               # Módulo mapa
│   ├── components/              # Componentes compartidos
│   ├── lib/
│   │   ├── api.ts              # Cliente Axios
│   │   └── types.ts            # Tipos TypeScript
│   └── public/                  # Assets estáticos
├── clientes_maestro.json        # Datos maestros de clientes
├── requirements.txt             # Dependencias Python
├── .env                         # Variables de entorno (NO SUBIR)
├── .gitignore                   # Archivos ignorados
├── CLAUDE.md                    # Documentación técnica detallada
└── README.md                    # Este archivo
```

## Lógica de Negocio

### Clasificación de Estados de Cliente

Los clientes se clasifican en 3 estados según el tiempo transcurrido desde su última sesión válida:

- **OK** (Verde): Última sesión ≤ 30 días
- **ATENCIÓN** (Amarillo): Última sesión entre 31-60 días
- **CRÍTICO** (Rojo): Última sesión > 60 días o sin sesiones

**Importante**: Solo se cuentan como sesiones válidas las reuniones con `is_client_meeting=true` (incluye estados CONFIRMED y PROBABLE).

### Algoritmo de Matching

El sistema usa matching multi-nivel con detección de word-boundaries:

1. **Detección de eventos personales** (Status: NO_MATCH) - Filtra eventos no laborales
2. **Detección de reuniones internas** (Status: INTERNAL) - Solo asistentes @dentaldata.es
3. **Match exacto por email** (Status: CONFIRMED, 100% confianza)
4. **Match exacto por nombre con word-boundaries** (Status: CONFIRMED, 94-98% confianza)
   - Evita falsos positivos (ej: "antia" no matchea con "garantia")
5. **Sin match** (Status: NO_MATCH)

**Nota**: El fuzzy matching está deshabilitado para maximizar precisión.

### Sincronización de Clínicas Multi-Sede

El sistema sincroniza automáticamente appointments para 6 grupos de clínicas que comparten reuniones:

- Amelar (2 sedes)
- Junyent (2 sedes)
- Almidental (2 sedes)
- Smilodon (2 sedes)
- Garantía Dental (2 sedes)
- Elite (7 sedes)

## Endpoints de API

### Principal

- `GET /` - Health check
- `GET /appointments` - Lista de appointments con filtros
- `GET /clients` - Lista de clientes
- `GET /stats/summary` - Estadísticas del dashboard
- `GET /clients/with-meetings` - Clientes con reuniones
- `GET /clients/without-meetings` - Clientes sin reuniones

Ver documentación completa en `/docs` cuando el backend esté corriendo.

## Tecnologías

### Backend
- FastAPI 0.104+
- SQLAlchemy 2.0+
- PostgreSQL (driver pg8000)
- Google Calendar API
- Python-dotenv
- Uvicorn

### Frontend
- Next.js 15
- React 19
- TypeScript 5.9
- Tailwind CSS v4
- SWR
- Leaflet + React-Leaflet
- Axios
- date-fns
- Lucide React (iconos)

## Contribución

Este es un proyecto interno de Dental Data. Para contribuir:

1. Crear feature branch desde `main`
2. Realizar cambios siguiendo convenciones del proyecto
3. Actualizar [CLAUDE.md](CLAUDE.md) si aplica
4. Crear Pull Request con descripción detallada

## Licencia

Propiedad de Dental Data - Uso interno exclusivamente.

## Soporte

Para preguntas o issues, contactar al equipo de desarrollo interno.

---

**Última actualización**: Diciembre 2025
**Versión**: 2.1
