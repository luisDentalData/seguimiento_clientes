@echo off
REM ============================================================================
REM START DOCKER - Iniciar aplicación completa con Docker Compose
REM ============================================================================
REM Este script inicia todos los servicios (PostgreSQL, Backend, Frontend)
REM usando Docker Compose.
REM
REM Uso:
REM   start_docker.bat          - Inicia todos los servicios
REM   start_docker.bat --build  - Reconstruye las imágenes antes de iniciar
REM ============================================================================

echo.
echo ========================================
echo   INICIANDO SEGUIMIENTO CLIENTES
echo   Con Docker Compose
echo ========================================
echo.

REM Verificar si Docker está corriendo
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker no está corriendo
    echo Por favor inicia Docker Desktop
    pause
    exit /b 1
)

echo [OK] Docker está corriendo
echo.

REM Verificar si se pidió rebuild
if "%1"=="--build" (
    echo [INFO] Reconstruyendo imágenes Docker...
    docker-compose up -d --build
) else (
    echo [INFO] Iniciando servicios...
    docker-compose up -d
)

if errorlevel 1 (
    echo.
    echo [ERROR] Fallo al iniciar servicios
    pause
    exit /b 1
)

echo.
echo ========================================
echo   SERVICIOS INICIADOS
echo ========================================
echo.
echo Backend:   http://127.0.0.1:8000
echo API Docs:  http://127.0.0.1:8000/docs
echo Frontend:  http://127.0.0.1:3000
echo.
echo PostgreSQL: localhost:5432
echo   User:     postgres
echo   Password: dentaldata
echo   Database: dentaldata
echo.
echo ========================================
echo   COMANDOS UTILES
echo ========================================
echo.
echo Ver logs:           docker-compose logs -f
echo Ver logs backend:   docker-compose logs -f backend
echo Ver logs frontend:  docker-compose logs -f frontend
echo.
echo Detener servicios:  docker-compose down
echo Reiniciar:          docker-compose restart
echo.
echo Estado servicios:   docker-compose ps
echo.
echo ========================================
echo.

REM Abrir navegador automáticamente en el frontend
timeout /t 3 /nobreak >nul
start http://127.0.0.1:3000

echo Presiona cualquier tecla para ver los logs en tiempo real...
pause >nul

REM Mostrar logs
docker-compose logs -f
