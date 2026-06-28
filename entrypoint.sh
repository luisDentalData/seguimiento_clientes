#!/bin/sh
# Entrypoint for Cloud Run — applies pending DB migrations before starting the server.
PORT=${PORT:-8000}

echo "[entrypoint] Running database migrations..."
alembic upgrade head || { echo "[entrypoint] Migration failed — aborting startup"; exit 1; }
echo "[entrypoint] Migrations complete. Starting server on port $PORT..."
exec uvicorn src.main:app --host 0.0.0.0 --port "$PORT"
