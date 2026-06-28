@echo off
REM ============================================================
REM  Cloud SQL Auth Proxy — Conexión local a la DB de producción
REM  Instancia: seguimientoclientes-483013:europe-southwest1:dentaldata-db
REM  Puerto local: 5433 (para no pisar un Postgres local en 5432)
REM ============================================================
REM
REM  REQUISITOS PREVIOS (una sola vez):
REM  1. Instalar gcloud CLI: https://cloud.google.com/sdk/docs/install
REM  2. Autenticarse: gcloud auth application-default login
REM  3. Descargar cloud-sql-proxy.exe y copiarlo junto a este script:
REM     https://github.com/GoogleCloudPlatform/cloud-sql-proxy/releases/latest
REM     → descargar cloud-sql-proxy.x64.exe → renombrar a cloud-sql-proxy.exe
REM
REM  USO:
REM  - Ejecutar este script en una terminal aparte (debe quedar corriendo)
REM  - Cambiar DATABASE_URL en .env a:
REM    postgresql+pg8000://postgres:dentaldata@127.0.0.1:5433/dentaldata
REM  - Arrancar el backend normalmente (start_dev.bat o uvicorn manual)
REM ============================================================

setlocal

set PROXY_EXE=%~dp0cloud-sql-proxy.exe
set INSTANCE=seguimientoclientes-483013:europe-southwest1:dentaldata-db
set PORT=5433

if not exist "%PROXY_EXE%" (
    echo.
    echo [ERROR] No se encontro cloud-sql-proxy.exe en:
    echo         %PROXY_EXE%
    echo.
    echo Descargalo de:
    echo https://github.com/GoogleCloudPlatform/cloud-sql-proxy/releases/latest
    echo Buscá: cloud-sql-proxy.x64.exe  → renombralo a cloud-sql-proxy.exe
    echo Copialo al mismo directorio que este script.
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  Cloud SQL Auth Proxy
echo  Instancia : %INSTANCE%
echo  Puerto    : localhost:%PORT%
echo ============================================================
echo.
echo Conectando... (Ctrl+C para detener)
echo.

"%PROXY_EXE%" "%INSTANCE%" --port=%PORT%
