#!/bin/sh
# Entrypoint for Cloud Run — applies pending DB migrations before starting the server.
PORT=${PORT:-8000}

echo "[entrypoint] Checking migration state..."

# If the DB was created before Alembic was introduced (no alembic_version table),
# stamp the baseline so Alembic knows the schema already exists.
python3 - <<'PYEOF'
import sys, os
import sqlalchemy

url = os.environ.get("DATABASE_URL", "")
try:
    engine = sqlalchemy.create_engine(url)
    with engine.connect() as conn:
        try:
            conn.execute(sqlalchemy.text("SELECT 1 FROM alembic_version LIMIT 1"))
            # Table exists — nothing to do
            sys.exit(0)
        except Exception as e:
            err = str(e).lower()
            if "alembic_version" in err or "does not exist" in err or "no such table" in err:
                sys.exit(1)  # Needs stamp
            else:
                print(f"[entrypoint] Unexpected DB error: {e}", file=sys.stderr)
                sys.exit(2)  # Unknown error — abort
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
fi

echo "[entrypoint] Running database migrations..."
alembic upgrade head || { echo "[entrypoint] Migration failed — aborting startup"; exit 1; }
echo "[entrypoint] Migrations complete. Starting server on port $PORT..."
exec uvicorn src.main:app --host 0.0.0.0 --port "$PORT"
