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

        # Check if alembic_version table exists
        has_alembic = False
        try:
            conn.execute(sqlalchemy.text("SELECT 1 FROM alembic_version LIMIT 1"))
            has_alembic = True
        except Exception as e:
            err = str(e).lower()
            if not ("alembic_version" in err or "does not exist" in err or "no such table" in err):
                print(f"[entrypoint] Unexpected DB error: {e}", file=sys.stderr)
                sys.exit(2)

        # Check if core tables actually exist
        has_tables = False
        try:
            conn.execute(sqlalchemy.text("SELECT 1 FROM clients LIMIT 1"))
            has_tables = True
        except Exception:
            pass

        if has_alembic and has_tables:
            sys.exit(0)  # Normal: Alembic tracking + tables exist → just upgrade head
        elif not has_alembic and has_tables:
            sys.exit(1)  # Pre-Alembic DB: tables exist but no tracking → stamp baseline
        else:
            sys.exit(3)  # Fresh or broken DB: no tables → create_all + stamp head

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
