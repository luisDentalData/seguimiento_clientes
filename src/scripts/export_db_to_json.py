
import sys
import os
import json
from sqlalchemy.orm import Session

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.database import SessionLocal
from src.models import Client

def export_clients():
    db = SessionLocal()
    try:
        clients = db.query(Client).all()
        data = []
        for c in clients:
            emails = [e.email for e in c.emails]
            data.append({
                "id": c.id,
                "nombre": c.name,
                "status": c.status,
                "emails": emails,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None
            })
        
        output_file = "clientes_recuperados_db.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
            
        print(f"Exported {len(data)} clients to {output_file}")
        
    except Exception as e:
        print(f"Export failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    export_clients()
