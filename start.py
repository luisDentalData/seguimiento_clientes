#!/usr/bin/env python3
"""
Startup script for Cloud Run
Handles PORT environment variable correctly
"""
import os
import sys

# Ensure /app is in PYTHONPATH so Python can find the 'src' module
app_dir = "/app"
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)
    print(f"Added {app_dir} to sys.path", flush=True)

# Also set PYTHONPATH environment variable for uvicorn subprocess
os.environ["PYTHONPATH"] = app_dir

# Get PORT from environment or default to 8000
port = os.environ.get("PORT", "8000")

print(f"Starting uvicorn on port {port}...", flush=True)
print(f"PYTHONPATH: {os.environ.get('PYTHONPATH')}", flush=True)
print(f"sys.path: {sys.path[:3]}", flush=True)

# Use exec to replace this process with uvicorn
os.execvp("uvicorn", [
    "uvicorn",
    "src.main:app",
    "--host", "0.0.0.0",
    "--port", port
])
