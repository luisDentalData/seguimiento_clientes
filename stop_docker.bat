@echo off
REM ============================================================================
REM STOP DOCKER - Detener aplicación Docker Compose
REM ============================================================================
REM Este script detiene todos los servicios de Docker Compose.
REM
REM Uso:
REM   stop_docker.bat        - Detiene servicios (mantiene datos)
REM   stop_docker.bat --hard - Detiene y elimina todo (incluyendo datos)
REM ============================================================================

echo.
echo ========================================
echo   DETENIENDO SEGUIMIENTO CLIENTES
echo ========================================
echo.

if "%1"=="--hard" (
    echo [WARNING] Modo HARD: Eliminando contenedores, volumenes y redes
    echo Esto ELIMINARA todos los datos de la base de datos!
    echo.
    choice /C YN /M "¿Estas seguro?"
    if errorlevel 2 exit /b 0

    docker-compose down -v
    echo.
    echo [OK] Servicios detenidos y datos eliminados
) else (
    docker-compose down
    echo.
    echo [OK] Servicios detenidos (datos preservados)
)

echo.
echo Presiona cualquier tecla para salir...
pause >nul
