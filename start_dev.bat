@echo off
echo ========================================
echo DENTAL DATA - SEGUIMIENTO CLIENTES
echo Iniciando Backend y Frontend
echo ========================================

REM Verificar que estamos en el directorio correcto
if not exist "src\main.py" (
    echo ERROR: No se encuentra src\main.py
    echo Por favor ejecuta este script desde el directorio raiz del proyecto
    pause
    exit /b 1
)

if not exist "dashboard\package.json" (
    echo ERROR: No se encuentra dashboard\package.json
    pause
    exit /b 1
)

echo.
echo [1/2] Iniciando Backend (FastAPI)...
echo Puerto: 8000
echo.
start "Backend - FastAPI" cmd /k "python -m uvicorn src.main:app --host 127.0.0.1 --port 8000 --reload"

echo.
echo [2/2] Iniciando Frontend (Next.js)...
echo Puerto: 3000
echo.
start "Frontend - Next.js" cmd /k "cd dashboard && npm run dev"

echo.
echo ========================================
echo Servicios iniciados correctamente!
echo ========================================
echo.
echo Backend:  http://127.0.0.1:8000
echo API Docs: http://127.0.0.1:8000/docs
echo Frontend: http://localhost:3000
echo.
echo Presiona cualquier tecla para cerrar esta ventana
echo (los servicios seguiran corriendo en sus propias ventanas)
pause > nul
