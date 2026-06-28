#!/bin/sh
# Entrypoint for Cloud Run — applies pending DB migrations before starting the server.
PORT=${PORT:-8000}

echo "[entrypoint] Checking migration state..."

python3 - <<'PYEOF'
import sys, os
import sqlalchemy

url = os.environ.get("DATABASE_URL", "")
try:
    engine = sqlalchemy.create_engine(url)
    with engine.connect() as conn:
        # 1. Check if alembic_version table exists
        try:
            conn.execute(sqlalchemy.text("SELECT 1 FROM alembic_version LIMIT 1"))
            sys.exit(0)  # Alembic already tracking — just run upgrade head
        except Exception as e:
            err = str(e).lower()
            if not ("alembic_version" in err or "does not exist" in err or "no such table" in err):
                print(f"[entrypoint] Unexpected DB error: {e}", file=sys.stderr)
                sys.exit(2)

        # 2. No alembic_version — check if core tables exist (pre-Alembic DB)
        try:
            conn.execute(sqlalchemy.text("SELECT 1 FROM clients LIMIT 1"))
            sys.exit(1)  # Tables exist but no Alembic tracking → stamp baseline
        except Exception:
            sys.exit(3)  # Completely fresh DB — no tables at all

except Exception as e:
    print(f"[entrypoint] Cannot connect to DB: {e}", file=sys.stderr)
    sys.exit(2)
PYEOF

RC=$?

if [ "$RC" -eq 1 ]; then
    echo "[entrypoint] DB predates Alembic — stamping baseline migration (03d2c807e4fc)..."
    alembic stamp 03d2c807e4fc || { echo "[entrypoint] Stamp failed — aborting"; exit 1; }

elif [ "$RC" -eq 2 ]; then
    echo "[entrypoint] DB connection error — aborting startup"
    exit 1

elif [ "$RC" -eq 3 ]; then
    echo "[entrypoint] Fresh DB — creating full schema via SQLAlchemy and stamping head..."
    python3 -c "
import os, sys
sys.path.insert(0, '/app')
from src.database import Base, engine
from src import models  # registers all models on Base.metadata
Base.metadata.create_all(bind=engine)
print('[entrypoint] All tables created.')
" || { echo "[entrypoint] create_all failed — aborting"; exit 1; }
    alembic stamp head || { echo "[entrypoint] Stamp head failed — aborting"; exit 1; }
    echo "[entrypoint] Schema ready. Starting server on port $PORT..."
    exec uvicorn src.main:app --host 0.0.0.0 --port "$PORT"
fi

echo "[entrypoint] Running database migrations..."
alembic upgrade head || { echo "[entrypoint] Migration failed — aborting startup"; exit 1; }
echo "[entrypoint] Migrations complete. Starting server on port $PORT..."
exec uvicorn src.main:app --host 0.0.0.0 --port "$PORT"
