#!/bin/sh
# Entrypoint script for Cloud Run
# This ensures PORT variable is properly handled

# Use PORT from environment or default to 8000
PORT=${PORT:-8000}

# Start uvicorn with the PORT variable
exec uvicorn src.main:app --host 0.0.0.0 --port "$PORT"
