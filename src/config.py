import os
from dotenv import load_dotenv

load_dotenv()

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+pg8000://postgres:password@localhost:5432/sirc_db")

# Google
GOOGLE_CREDENTIALS_PATH = os.getenv("GOOGLE_CREDENTIALS_PATH", "credentials.json")
# Default to real analysts if not in env
ANALYST_EMAILS = os.getenv("ANALYST_EMAILS", "u.barroso@dentaldata.es,m.val@dentaldata.es,c.bosom@dentaldata.es").split(",")
IMPERSONATE_EMAIL = os.getenv("IMPERSONATE_EMAIL", "luis@dentaldata.es")

# Defaults - Full year historical data (Jan 2025 - Dec 2026)
DEFAULT_START_DATE = '2025-01-01T00:00:00Z'
DEFAULT_END_DATE = '2026-12-31T23:59:59Z'
