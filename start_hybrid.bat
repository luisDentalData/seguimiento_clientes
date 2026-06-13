@echo off
REM ============================================================================
REM START HYBRID - Modo híbrido con PostgreSQL local
REM ============================================================================
REM Este script inicia Backend y Frontend en Docker,
REM pero usa tu PostgreSQL local existente.
REM
REM REQUISITOS:
REM   - PostgreSQL debe estar corriendo en localhost:5432
REM   - Base de datos: dentaldata
REM   - Usuario: postgres
REM   - Contraseña: dentaldata
REM ============================================================================

echo.
echo ========================================
echo   MODO HIBRIDO
echo   PostgreSQL Local + Docker
echo ========================================
echo.

REM Verificar Docker
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker no está corriendo
    pause
    exit /b 1
)
echo [OK] Docker está corriendo

REM Verificar PostgreSQL local
echo [INFO] Verificando PostgreSQL local...
pg_isready -h localhost -p 5432 -U postgres >nul 2>&1
if errorlevel 1 (
    echo [WARNING] No se pudo conectar a PostgreSQL local
    echo Asegurate de que PostgreSQL está corriendo en localhost:5432
    echo.
    choice /C YN /M "¿Continuar de todas formas?"
    if errorlevel 2 exit /b 0
) else (
    echo [OK] PostgreSQL local está corriendo
)

echo.
echo [INFO] Iniciando Backend y Frontend en Docker...

REM Iniciar con docker-compose alternativo
docker-compose -f docker-compose.local-db.yml up -d

if errorlevel 1 (
    echo [ERROR] Fallo al iniciar servicios
    pause
    exit /b 1
)

echo.
echo ========================================
echo   SERVICIOS INICIADOS (MODO HIBRIDO)
echo ========================================
echo.
echo Backend:   http://127.0.0.1:8000
echo API Docs:  http://127.0.0.1:8000/docs
echo Frontend:  http://127.0.0.1:3000
echo.
echo PostgreSQL: localhost:5432 (TU POSTGRES LOCAL)
echo.
echo ========================================
echo   COMANDOS UTILES
echo ========================================
echo.
echo Ver logs:  docker-compose -f docker-compose.local-db.yml logs -f
echo Detener:   docker-compose -f docker-compose.local-db.yml down
echo Reiniciar: docker-compose -f docker-compose.local-db.yml restart
echo.
echo ========================================
echo.

timeout /t 3 /nobreak >nul
start http://127.0.0.1:3000

echo Presiona cualquier tecla para ver los logs...
pause >nul

docker-compose -f docker-compose.local-db.yml logs -f
