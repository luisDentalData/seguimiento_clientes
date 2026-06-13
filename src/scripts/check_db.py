import sys
import os

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.database import SessionLocal
from src.models import Client, ClientEmail
from sqlalchemy import func

def check_db():
    db = SessionLocal()
    try:
        client_count = db.query(func.count(Client.id)).scalar()
        email_count = db.query(func.count(ClientEmail.id)).scalar()
        
        print(f"Total Clients in DB: {client_count}")
        print(f"Total Emails in DB: {email_count}")
        
        # Sample
        first_client = db.query(Client).first()
        if first_client:
            print(f"Sample Client: {first_client.name} (ID: {first_client.id})")
            print(f"  Emails: {[e.email for e in first_client.emails]}")
            
    finally:
        db.close()

if __name__ == "__main__":
    check_db()
