"""
Script para cargar datos desde clientes_maestro.json a la base de datos
Elimina todos los clientes existentes y carga los nuevos datos maestros
"""

import sys
import os
import json

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.database import SessionLocal, engine, Base
from src.models import Client, ClientEmail

def load_clientes_maestro():
    """Carga los clientes desde clientes_maestro.json"""

    maestro_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        'clientes_maestro.json'
    )

    print(f"Cargando datos desde: {maestro_path}")

    with open(maestro_path, 'r', encoding='utf-8') as f:
        clientes_data = json.load(f)

    print(f"Total de clientes a cargar: {len(clientes_data)}")

    # Recrear tablas
    print("\n1. Eliminando tablas existentes...")
    Base.metadata.drop_all(bind=engine)

    print("2. Creando tablas nuevas con esquema actualizado...")
    Base.metadata.create_all(bind=engine)

    # Crear sesión
    db = SessionLocal()

    try:
        print("\n3. Insertando clientes...")
        total_inserted = 0
        total_emails = 0
        emails_set = set()  # Para rastrear emails y evitar duplicados

        for cliente_data in clientes_data:
            # Crear cliente
            status_value = cliente_data.get('status', 'ACTIVE').upper()
            client = Client(
                id=cliente_data.get('id'),
                name=cliente_data.get('name') or cliente_data.get('nombre'),  # Support both keys
                nombre_normalizado=cliente_data.get('nombre_normalizado'),
                nombres_alternativos=cliente_data.get('nombres_alternativos', []),
                nombre_contacto=cliente_data.get('nombre_contacto'),
                telefono=cliente_data.get('telefono'),
                movil=cliente_data.get('movil'),
                direccion=cliente_data.get('direccion'),
                poblacion=cliente_data.get('poblacion'),
                provincia=cliente_data.get('provincia'),
                nif_cif=cliente_data.get('nif_cif'),
                programa=cliente_data.get('programa'),
                fuentes=cliente_data.get('fuentes', []),
                status=status_value,
                is_active=(status_value == 'ACTIVE')
            )

            db.add(client)
            db.flush()  # Para obtener el ID del cliente

            # Agregar emails (evitando duplicados)
            emails = cliente_data.get('emails', [])
            for email in emails:
                if email:  # Solo si el email no está vacío
                    email_clean = email.lower().strip()
                    if email_clean not in emails_set:
                        try:
                            client_email = ClientEmail(
                                client_id=client.id,
                                email=email_clean
                            )
                            db.add(client_email)
                            emails_set.add(email_clean)
                            total_emails += 1
                        except Exception as e:
                            print(f"   Error agregando email {email} para {client.name}: {e}")
                    else:
                        print(f"   AVISO: Email duplicado {email_clean} omitido para {client.name}")

            total_inserted += 1

            if total_inserted % 20 == 0:
                print(f"   Procesados: {total_inserted}/{len(clientes_data)}")

        db.commit()

        print(f"\n[OK] MIGRACION COMPLETADA")
        print(f"   - Clientes insertados: {total_inserted}")
        print(f"   - Emails registrados: {total_emails}")
        print(f"   - Promedio emails por cliente: {total_emails/total_inserted:.2f}")

        # Mostrar estadísticas por programa
        programas = {}
        for c in clientes_data:
            prog = c.get('programa', 'sin_programa')
            programas[prog] = programas.get(prog, 0) + 1

        print(f"\nDistribucion por programa de gestion:")
        for prog, count in sorted(programas.items(), key=lambda x: x[1], reverse=True):
            print(f"   - {prog}: {count} clientes")

    except Exception as e:
        print(f"\n[ERROR] durante la migracion: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("="*60)
    print("  MIGRACIÓN DE CLIENTES MAESTROS A BASE DE DATOS")
    print("="*60)
    load_clientes_maestro()
