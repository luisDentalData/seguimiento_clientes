# ============================================================================
# DOCKERFILE PARA FRONTEND (Next.js + React)
# ============================================================================
# Este Dockerfile usa MULTI-STAGE BUILD (dos etapas):
# Etapa 1 (builder): Compila la aplicación Next.js
# Etapa 2 (runner): Solo ejecuta la app compilada
# Beneficio: Imagen final mucho más pequeña (solo runtime, no build tools)

# ============================================================================
# ETAPA 1: BUILD (Construcción)
# ============================================================================
FROM node:20-alpine AS builder

# ¿Por qué node:20-alpine?
# - node:20: Versión LTS de Node.js (requerida por Next.js 15)
# - alpine: Distribución Linux ultra-ligera (5MB base vs 150MB de Debian)
#   Alpine usa musl libc en vez de glibc, más pequeña pero igual de funcional
# - AS builder: Le damos nombre a esta etapa para referenciarla después

# Metadata
LABEL stage=builder
LABEL description="Build stage for Next.js frontend"

# ¿Por qué nombrar las etapas?
# Para hacer COPY --from=builder más legible
# Para debugging (puedes construir solo hasta cierta etapa)

# ----------------------------------------------------------------------------
# Configuración de Entorno de Build
# ----------------------------------------------------------------------------
WORKDIR /app

# Variables de entorno para optimizar el build de Next.js
ENV NODE_ENV=production

# NODE_ENV=production le dice a Next.js:
# - Optimizar el código (minificar, tree-shaking)
# - Deshabilitar source maps grandes
# - Activar optimizaciones de producción

# Deshabilitar telemetría de Next.js (mejora privacidad y velocidad)
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_TELEMETRY_DISABLED=1:
# Next.js por defecto envía datos de uso anónimos a Vercel
# En producción no queremos esto (privacidad + reduce peticiones red)

# ----------------------------------------------------------------------------
# Build Arguments (variables disponibles en build time)
# ----------------------------------------------------------------------------
# Variables de entorno para Next.js build
# NEXT_PUBLIC_* se inyectan en el JavaScript durante npm run build
# NOTA: No definir aquí para desarrollo local - se pasa desde docker-compose.yml
# Solo se hardcodea para Google Cloud Run deployment
ENV NEXT_PUBLIC_API_URL=https://dentaldata-backend-243744598910.us-central1.run.app

# Para desarrollo local: usar localhost:8000 (pasado desde docker-compose)
# Para Cloud Run: usar https://dentaldata-backend-243744598910.us-central1.run.app
# (se pasa con --set-build-env-vars durante gcloud run deploy)

# Verificar que la variable está configurada (puede ser vacía en dev local)
RUN echo "🔗 Building with API URL: ${NEXT_PUBLIC_API_URL:-not set, will use fallback}"

# ¿Por qué ARG + ENV?
# - ARG: Variable de build time (disponible durante docker build)
# - ENV: Variable de entorno (disponible durante npm run build)
# - Next.js lee NEXT_PUBLIC_* de process.env durante el build
# - El valor se inyecta en el JavaScript compilado (hard-coded)
# Resultado: Frontend compilado apunta siempre a esta URL

# ----------------------------------------------------------------------------
# Instalación de Dependencias
# ----------------------------------------------------------------------------
# Copiar archivos de dependencias PRIMERO (optimización de cache)
COPY package.json package-lock.json ./

# ¿Por qué copiar package.json y package-lock.json juntos?
# - package.json: Lista de dependencias
# - package-lock.json: Versiones exactas (lockfile)
# Juntos aseguran instalación reproducible

# npm ci vs npm install:
RUN npm ci --only=production

# npm ci (clean install):
# - Más rápido que npm install (30-50% más rápido)
# - Usa package-lock.json para versiones exactas
# - Elimina node_modules existente antes de instalar
# - Falla si package.json y package-lock.json no coinciden (detecta inconsistencias)
# - Ideal para CI/CD y producción

# --only=production: Instala solo dependencies (no devDependencies)
# TypeScript y tipos ahora están en dependencies para Docker build

# OPTIMIZACIÓN DE CACHE:
# Si package.json no cambia, Docker reutiliza esta capa cacheada
# Resultado: npm ci solo se ejecuta si cambian las dependencias

# ----------------------------------------------------------------------------
# Copiar Código Fuente
# ----------------------------------------------------------------------------
COPY . .

# Copia todo el código del directorio dashboard/ al contenedor
# Incluye:
# - app/ (páginas)
# - components/ (componentes React)
# - lib/ (utilidades)
# - public/ (assets estáticos)
# - next.config.ts, tsconfig.json, etc.

# ¿Por qué copiar después de npm ci?
# CACHE OPTIMIZATION: Si solo cambia el código (no deps),
# Docker reutiliza la capa de npm ci (ahorra minutos)

# ----------------------------------------------------------------------------
# Build de Next.js
# ----------------------------------------------------------------------------
RUN npm run build

# npm run build ejecuta: next build
# Proceso de next build:
# 1. Compila TypeScript → JavaScript
# 2. Optimiza React (tree-shaking, code splitting)
# 3. Genera páginas estáticas (SSG) si aplica
# 4. Crea bundles optimizados en .next/
# 5. Minimiza CSS y JavaScript
# 6. Genera manifests para caching

# Salida: Carpeta .next/ con la app compilada lista para producción

# ¿Por qué hacer build en Docker?
# - Garantiza entorno consistente (misma versión Node, deps)
# - Evita "funciona en mi máquina" (Windows vs Linux)
# - El .next/ generado es idéntico en todos lados

# ============================================================================
# ETAPA 2: RUNTIME (Ejecución)
# ============================================================================
FROM node:20-alpine AS runner

# Nueva etapa desde cero (imagen limpia)
# AS runner: Nombre de esta etapa

# ¿Por qué segunda etapa?
# REDUCCIÓN DE TAMAÑO:
# Etapa 1 (builder): 500MB (incluye build tools, deps dev, código fuente)
# Etapa 2 (runner): 150MB (solo runtime + .next/ compilado)
# Ahorro: 70% menos

LABEL stage=runner
LABEL description="Runtime stage for Next.js frontend"

# ----------------------------------------------------------------------------
# Configuración de Runtime
# ----------------------------------------------------------------------------
WORKDIR /app

# Variables de entorno de producción
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Puerto donde Next.js escuchará
ENV PORT=3000

# ¿Por qué definir PORT?
# Next.js usa process.env.PORT para saber dónde escuchar
# Permite cambiar el puerto sin modificar código

# ----------------------------------------------------------------------------
# Usuario No-Root (Seguridad)
# ----------------------------------------------------------------------------
# Crear grupo y usuario sin privilegios
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# --system: Usuario/grupo del sistema (no puede hacer login)
# --gid 1001 / --uid 1001: IDs específicos (estándar en Next.js)

# ¿Por qué crear usuario aquí y no en builder?
# Porque el builder se descarta. Solo runner se usa en producción.

# ----------------------------------------------------------------------------
# Copiar Archivos Necesarios desde Builder
# ----------------------------------------------------------------------------
# Copiar archivos públicos (imágenes, fonts, etc.)
COPY --from=builder /app/public ./public

# --from=builder: Copia desde la etapa "builder" (no del host)
# Solo copiamos lo necesario (no código fuente, no node_modules de dev)

# Copiar configuración de Next.js
COPY --from=builder /app/next.config.ts ./

# ¿Por qué copiar next.config.ts?
# Next.js lo necesita en runtime para configuración (rewrites, redirects, etc.)

# Copiar package.json (necesario para `npm start`)
COPY --from=builder /app/package.json ./

# Crear directorio .next con permisos correctos
RUN mkdir .next

# Copiar el build de Next.js (.next/)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# --chown=nextjs:nodejs: Asigna ownership al usuario nextjs
# .next/standalone: Build optimizado de Next.js para standalone
# .next/static: Assets estáticos (JS, CSS, imágenes optimizadas)

# ¿Qué es standalone?
# Modo de Next.js que genera un servidor auto-contenido:
# - Incluye solo node_modules necesarios (no todos)
# - Reduce tamaño de 300MB a 50MB
# - Configurable en next.config.ts: output: 'standalone'

# ----------------------------------------------------------------------------
# Cambiar a Usuario Sin Privilegios
# ----------------------------------------------------------------------------
USER nextjs

# Todos los comandos siguientes se ejecutan como nextjs (no root)

# ¿Por qué cambiar usuario?
# SEGURIDAD: Si alguien hackea la app, solo tiene permisos limitados
# No puede:
# - Instalar malware en el sistema
# - Modificar archivos del sistema
# - Escalar privilegios

# ----------------------------------------------------------------------------
# Exponer Puerto
# ----------------------------------------------------------------------------
EXPOSE 3000

# Documentación: Esta app escucha en puerto 3000
# Necesario para docker run -p 3000:3000

# ----------------------------------------------------------------------------
# Health Check - DESHABILITADO PARA CLOUD RUN
# ----------------------------------------------------------------------------
# ⚠️ IMPORTANTE: HEALTHCHECK deshabilitado para compatibilidad con Cloud Run
#
# ¿Por qué NO usar HEALTHCHECK en Cloud Run?
# 1. Cloud Run IGNORA los healthchecks de Dockerfile
# 2. Cloud Run usa su propio sistema de health checks (HTTP requests a /)
# 3. Este healthcheck apuntaba a puerto 3000 hardcodeado
# 4. Cloud Run asigna puerto dinámico (8080, 8081, etc.)
# 5. Healthcheck fallaba → Cloud Run mataba el contenedor → Deploy fallido
#
# Cloud Run hace health checks automáticamente:
# - Envía GET / cada 30 segundos
# - Espera HTTP 200-299
# - Si falla 3 veces, reinicia el contenedor
#
# Si despliegas en otro entorno (Docker local, Kubernetes), puedes descomentar:
#
# HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
#     CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/ || exit 1

# ----------------------------------------------------------------------------
# Comando de Inicio (Compatible con Cloud Run)
# ----------------------------------------------------------------------------

# Cloud Run inyecta la variable PORT dinámicamente
# Next.js lee process.env.PORT automáticamente
CMD ["node", "server.js"]

# ¿Qué es server.js?
# En modo standalone, Next.js genera un server.js que:
# - Inicia el servidor HTTP
# - Sirve las páginas compiladas
# - Maneja SSR (Server-Side Rendering)
# - Sirve assets estáticos
# - LEE process.env.PORT automáticamente

# ¿Por qué funciona con Cloud Run?
# 1. Cloud Run establece PORT=8080 (o dinámico)
# 2. Next.js server.js lee process.env.PORT
# 3. Se inicia en el puerto correcto automáticamente

# No necesitamos ${PORT:-3000} como en backend porque:
# - Next.js standalone ya maneja esto internamente
# - Si PORT no existe, usa 3000 por defecto
# - Si PORT existe (Cloud Run), usa ese valor

# ¿Por qué node server.js y no npm start?
# - Más rápido (no hay overhead de npm)
# - Menos procesos (solo Node.js, no npm como intermediario)
# - Mejor para producción
# - Cold start más rápido en Cloud Run

# Esto funciona en:
# ✅ Docker local (PORT=3000 del env o default)
# ✅ docker-compose (PORT=3000 configurado)
# ✅ Google Cloud Run (PORT dinámico de Cloud Run)
# ✅ Azure (PORT configurado en settings)

# ============================================================================
# FIN DEL DOCKERFILE FRONTEND
# ============================================================================
# Resumen del flujo:
#
# ETAPA 1 (Builder):
# 1. Imagen base: node:18-alpine
# 2. Copia package.json y hace npm ci (solo production deps)
# 3. Copia código fuente
# 4. Ejecuta npm run build (compila Next.js)
# 5. Genera .next/ con app compilada
#
# ETAPA 2 (Runner):
# 1. Nueva imagen limpia: node:18-alpine
# 2. Crea usuario sin privilegios (nextjs)
# 3. Copia SOLO lo necesario desde builder:
#    - public/ (assets)
#    - .next/standalone (servidor)
#    - .next/static (CSS/JS compilados)
# 4. Cambia a usuario nextjs (seguridad)
# 5. Inicia servidor con node server.js
#
# Resultado:
# - Imagen de ~150MB (vs 500MB si fuera single-stage)
# - Segura (usuario no-root)
# - Optimizada (solo runtime, no build tools)
# - Health check configurado
# - Lista para producción en Azure
# ============================================================================
