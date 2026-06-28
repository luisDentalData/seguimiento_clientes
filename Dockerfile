# ============================================================================
# DOCKERFILE PARA BACKEND (FastAPI + Python)
# ============================================================================
# Este archivo define cómo construir la imagen Docker del backend.
# Una "imagen" es como una plantilla que contiene todo lo necesario para
# ejecutar la aplicación (sistema operativo, dependencias, código).

# ----------------------------------------------------------------------------
# ETAPA 1: Imagen Base
# ----------------------------------------------------------------------------
# FROM especifica la imagen base desde la cual partimos.
# Es como elegir el "sistema operativo" de nuestro contenedor.
FROM python:3.12-slim

# ¿Por qué python:3.12-slim?
# - python:3.12 → Versión exacta que usas en desarrollo (evita incompatibilidades)
# - slim → Versión reducida de Debian (250MB vs 900MB de la versión completa)
#          Incluye solo lo esencial, reduciendo superficie de ataque y tamaño
# - Alternativa: python:3.12-alpine (más pequeña, 50MB, pero puede tener problemas
#   con algunas librerías que requieren compilación)

# ----------------------------------------------------------------------------
# ETAPA 2: Metadata
# ----------------------------------------------------------------------------
# LABEL agrega metadata a la imagen (útil para documentación y gestión)
LABEL maintainer="dentaldata@example.com"
LABEL description="Backend FastAPI para Seguimiento de Clientes"
LABEL version="1.0"

# Estos labels se pueden consultar con: docker inspect <imagen>
# Útil para saber quién mantiene la imagen, qué versión es, etc.

# ----------------------------------------------------------------------------
# ETAPA 3: Variables de Entorno
# ----------------------------------------------------------------------------
# ENV define variables de entorno que estarán disponibles dentro del contenedor

# PYTHONUNBUFFERED=1 → Deshabilita el buffering de stdout/stderr
# ¿Por qué? Porque en Docker queremos ver los logs en tiempo real.
# Sin esto, los prints podrían no aparecer hasta que el buffer se llene.
ENV PYTHONUNBUFFERED=1

# PYTHONDONTWRITEBYTECODE=1 → Evita que Python cree archivos .pyc
# ¿Por qué? Los .pyc son archivos compilados que Python cachea.
# En un contenedor inmutable no necesitamos cache (se reconstruye cada vez).
# Ventaja: Reduce el tamaño de la imagen.
ENV PYTHONDONTWRITEBYTECODE=1

# PIP_NO_CACHE_DIR=1 → pip no guardará cache de paquetes descargados
# Reduce el tamaño de la imagen final (no necesitamos cache de pip).
ENV PIP_NO_CACHE_DIR=1

# PIP_DISABLE_PIP_VERSION_CHECK=1 → Desactiva el check de nueva versión de pip
# Acelera la instalación y evita warnings innecesarios.
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# PYTHONPATH=/app → Permite que Python encuentre el módulo src
# Sin esto, uvicorn no puede importar src.main:app
ENV PYTHONPATH=/app

# ----------------------------------------------------------------------------
# ETAPA 4: Directorio de Trabajo
# ----------------------------------------------------------------------------
# WORKDIR establece el directorio de trabajo dentro del contenedor
# Es equivalente a hacer "cd /app" en Linux
WORKDIR /app

# ¿Por qué /app?
# - Convención estándar en Docker
# - Mantiene el código de la aplicación separado del sistema
# - Todos los comandos siguientes se ejecutarán desde /app

# ----------------------------------------------------------------------------
# ETAPA 5: Instalación de Dependencias del Sistema
# ----------------------------------------------------------------------------
# RUN ejecuta comandos durante la construcción de la imagen
# Aquí instalamos dependencias del sistema operativo que necesita Python

RUN apt-get update && apt-get install -y \
    # curl: Para health checks y descargar archivos si es necesario
    curl \
    # gcc: Compilador C necesario para algunas librerías de Python (como pg8000)
    gcc \
    # Limpieza del cache de apt para reducir tamaño de imagen
    && rm -rf /var/lib/apt/lists/*

# ¿Por qué && en vez de múltiples RUN?
# Cada RUN crea una "capa" en Docker. Menos capas = imagen más eficiente.
# El && encadena comandos en una sola capa.

# ¿Por qué rm -rf /var/lib/apt/lists/*?
# Después de instalar, eliminamos el cache de apt (200MB+ ahorrados).
# No lo necesitamos en runtime, solo para la instalación.

# ----------------------------------------------------------------------------
# ETAPA 6: Instalación de Dependencias de Python
# ----------------------------------------------------------------------------
# COPY copia archivos desde tu máquina (host) al contenedor

# Primero copiamos SOLO requirements.txt (no todo el código aún)
COPY requirements.txt .

# ¿Por qué copiar requirements.txt primero?
# OPTIMIZACIÓN DE CACHE DE DOCKER:
# Docker cachea cada capa. Si requirements.txt no cambia, Docker reutiliza
# la capa de "pip install" sin reinstalar todo.
# Si copiáramos todo el código primero, cualquier cambio en el código
# forzaría a reinstalar todas las dependencias (lento).

# Instalamos las dependencias de Python
RUN pip install --no-cache-dir -r requirements.txt

# --no-cache-dir: No guarda cache de pip (reduce tamaño)
# -r requirements.txt: Instala desde el archivo requirements.txt

# ----------------------------------------------------------------------------
# ETAPA 7: Copiar Código de la Aplicación
# ----------------------------------------------------------------------------
# Ahora sí copiamos el código de la aplicación

# Copiar el directorio src/ completo
COPY src/ ./src/

# Copiar configuración y migraciones de Alembic
COPY alembic.ini .
COPY alembic/ ./alembic/

# Copiar entrypoint (ejecuta migraciones antes de arrancar uvicorn)
COPY entrypoint.sh .

# Copiar el script de inicio en Python
COPY start.py /app/start.py

# ¿Por qué copiar después de instalar dependencias?
# Si cambiamos código Python, solo se reconstruye desde aquí.
# Las capas anteriores (instalación de deps) se reutilizan del cache.
# Resultado: Builds 10x más rápidos.

# ----------------------------------------------------------------------------
# ETAPA 8: Crear Directorios Necesarios
# ----------------------------------------------------------------------------
# Crear directorio para logs (si no existe)
RUN mkdir -p /app/logs && chmod +x /app/entrypoint.sh

# -p: Crea directorios padres si no existen (no da error si ya existe)

# ¿Por qué crear el directorio aquí?
# Porque el código espera que exista. Si no existe, la app podría fallar.
# También asegura permisos correctos.

# ----------------------------------------------------------------------------
# ETAPA 9: Exponer Puerto
# ----------------------------------------------------------------------------
# EXPOSE documenta qué puerto usa la aplicación
EXPOSE 8000

# ¿Qué hace EXPOSE?
# NO abre el puerto realmente (es solo documentación).
# Le dice a quien use la imagen: "Esta app escucha en el puerto 8000".
# El puerto se abre realmente con docker run -p 8000:8000

# ¿Por qué 8000?
# Es el puerto donde uvicorn (FastAPI) escucha por defecto.

# ----------------------------------------------------------------------------
# ETAPA 10: Health Check - DESHABILITADO PARA CLOUD RUN
# ----------------------------------------------------------------------------
# ⚠️ IMPORTANTE: HEALTHCHECK deshabilitado para compatibilidad con Cloud Run
#
# ¿Por qué NO usar HEALTHCHECK en Cloud Run?
# 1. Cloud Run IGNORA los healthchecks de Dockerfile
# 2. Cloud Run usa su propio sistema de health checks (HTTP requests a /)
# 3. Este healthcheck apuntaba a puerto 8000 hardcodeado
# 4. Cloud Run asigna puerto dinámico (8080, 8081, etc.)
# 5. Healthcheck fallaba → Cloud Run mataba el contenedor → Deploy fallido
#
# Cloud Run hace health checks automáticamente:
# - Envía GET / cada 30 segundos
# - Espera HTTP 200-299
# - Si falla 3 veces, reinicia el contenedor
#
# Si despliegas en otro entorno (Azure, Kubernetes), puedes descomentar:
#
# HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
#     CMD curl -f http://localhost:${PORT:-8080}/ || exit 1
#
# Nota: Cambiaríamos localhost:8000 → localhost:${PORT:-8080} para que use
# el puerto correcto dinámicamente.

# ----------------------------------------------------------------------------
# ETAPA 11: Usuario No-Root (Seguridad) - COMENTADO PARA CLOUD RUN
# ----------------------------------------------------------------------------
# NOTA: Comentado temporalmente para compatibilidad con Cloud Run
# Cloud Run ya ejecuta contenedores de forma aislada y segura

# # Crear un usuario sin privilegios
# RUN adduser --disabled-password --gecos '' appuser
# RUN chown -R appuser:appuser /app
# USER appuser

# ----------------------------------------------------------------------------
# ETAPA 12: Comando de Inicio (Compatible con Cloud Run)
# ----------------------------------------------------------------------------
# CMD define el comando que se ejecuta cuando el contenedor inicia

# IMPORTANTE: Cloud Run inyecta la variable de entorno PORT dinámicamente
# No siempre es 8080, puede cambiar. Debemos usar $PORT.
# Usamos shell form (no JSON array) para poder usar variables de entorno

CMD ["sh", "entrypoint.sh"]

# Explicación detallada:
# - uvicorn src.main:app: Servidor ASGI para FastAPI
# - --host 0.0.0.0: Escucha en todas las interfaces
# - --port ${PORT:-8000}: USA VARIABLE DE ENTORNO
#
# ${PORT:-8000} significa:
# - Si existe $PORT (Cloud Run): usa ese valor
# - Si NO existe $PORT (local/docker-compose): usa 8000
#
# ¿Por qué esto es importante?
# Cloud Run asigna el puerto dinámicamente (puede ser 8080, 8081, etc.)
# Si hardcodeamos :8000, Cloud Run NO podrá conectarse
#
# Shell form vs JSON array:
# - JSON: ["cmd", "arg1"] → No puede usar variables de entorno
# - Shell: cmd arg1 → SÍ puede usar $PORT
#
# Esto funciona en:
# ✅ Docker local (usa 8000)
# ✅ docker-compose (usa 8000)
# ✅ Google Cloud Run (usa $PORT dinámico)
# ✅ Azure Container Apps (usa $PORT si se configura)

# ============================================================================
# FIN DEL DOCKERFILE BACKEND
# ============================================================================
# Resumen del flujo:
# 1. Parte de imagen Python 3.12 slim
# 2. Configura variables de entorno para optimización
# 3. Instala dependencias del sistema (curl, gcc)
# 4. Copia requirements.txt e instala deps de Python (con cache)
# 5. Copia código de la aplicación
# 6. Crea directorios necesarios
# 7. Configura health check
# 8. Cambia a usuario sin privilegios (seguridad)
# 9. Define comando de inicio (uvicorn)
#
# Resultado: Contenedor listo para ejecutar FastAPI en producción
# ============================================================================
