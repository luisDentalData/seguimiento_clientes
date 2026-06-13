"""
Quick script to check if Hondarribia event exists in database
"""
from sqlalchemy import create_engine, text
from src.config import DATABASE_URL

engine = create_engine(DATABASE_URL)

print("\n=== CHECKING HONDARRIBIA APPOINTMENTS ===\n")

with engine.connect() as conn:
    # Check appointments with "hondarribia" in title
    result = conn.execute(text("""
        SELECT
            id,
            title,
            start_time,
            match_status,
            matched_client_id,
            is_client_meeting,
            match_confidence,
            analyst_email
        FROM appointments
        WHERE LOWER(title) LIKE '%hondarribia%'
        ORDER BY start_time DESC
    """)).fetchall()

    print(f"Found {len(result)} appointment(s) with 'hondarribia' in title:\n")

    if result:
        for r in result:
            print(f"Event ID: {r[0]}")
            print(f"Title: {r[1]}")
            print(f"Date: {r[2]}")
            print(f"Match Status: {r[3]}")
            print(f"Matched Client ID: {r[4]}")
            print(f"Is Client Meeting: {r[5]}")
            print(f"Match Confidence: {r[6]}")
            print(f"Analyst: {r[7]}")
            print("-" * 80)
    else:
        print("⚠️ NO APPOINTMENTS FOUND")

    # Also check the client record
    print("\n=== CHECKING CLIENT RECORD ===\n")
    client = conn.execute(text("""
        SELECT id, name, nombre_normalizado
        FROM clients
        WHERE id = 'DD-00130'
    """)).fetchone()

    if client:
        print(f"Client ID: {client[0]}")
        print(f"Name: {client[1]}")
        print(f"Normalized: {client[2]}")

        # Check emails
        emails = conn.execute(text("""
            SELECT email
            FROM client_emails
            WHERE client_id = 'DD-00130'
        """)).fetchall()
        print(f"Emails: {[e[0] for e in emails]}")
    else:
        print("⚠️ CLIENT DD-00130 NOT FOUND")

print("\n" + "=" * 80)
