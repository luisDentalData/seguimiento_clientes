
import sys
import os
from datetime import datetime

# Path hack: Add project root (Seguimiento Clientes) to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database import SessionLocal
from src.config import ANALYST_EMAILS, DEFAULT_START_DATE, DEFAULT_END_DATE
from src.services.gcal import GCalService
from src.services.matching import Matcher
from src.services.clinic_sync import sync_clinic_groups
from src.domain.sync.groups import SYNC_GROUPS
from src.models import Appointment
from src.etl_logger import ETLLogger


def run_etl():
    # Inicializar logger profesional
    logger = ETLLogger(log_dir="logs")
    logger.start_execution()

    db = SessionLocal()

    try:
        # Initialize Services
        gcal = GCalService()
        matcher = Matcher(db)

        # Use config dates
        start_date = datetime.fromisoformat(DEFAULT_START_DATE.replace('Z', '+00:00'))
        end_date = datetime.fromisoformat(DEFAULT_END_DATE.replace('Z', '+00:00'))

        total_processed = 0
        total_matched = 0

        # DIRECT CALENDAR STRATEGY
        # Query each analyst's calendar directly to get all their events.
        logger.info(f"Fetching events directly from {len(ANALYST_EMAILS)} analyst calendars...")

        all_events = []
        for analyst_email in ANALYST_EMAILS:
            logger.log_fetching_start(analyst_email)
            try:
                events = gcal.get_events(analyst_email, start_date, end_date)
                logger.log_fetching_result(analyst_email, len(events))
                for event in events:
                    event['_analyst_email'] = analyst_email
                all_events.extend(events)
            except Exception as e:
                logger.log_error(f"Could not fetch events from {analyst_email}", e)
                continue

        logger.info(f"Total events from all analysts: {len(all_events)}")

        # Deduplicate events by event_id (same event can appear in multiple calendars).
        events_by_id = {}
        for event in all_events:
            event_id = event['id']
            event_analyst = event.get('_analyst_email')
            organizer = event.get('organizer', {}).get('email', '').lower()

            if event_id not in events_by_id:
                events_by_id[event_id] = event
            else:
                if organizer == event_analyst.lower():
                    events_by_id[event_id] = event

        unique_events = list(events_by_id.values())
        logger.info(f"Unique events (after deduplication): {len(unique_events)}")

        # Precargar appointments existentes en memoria (mata el N+1 por evento).
        existing_by_id = {a.id: a for a in db.query(Appointment).all()}

        # Process all unique events
        for event in unique_events:
            event_analyst = event.get('_analyst_email')
            event_id = event['id']
            summary = event.get('summary', 'No Title')

            existing = existing_by_id.get(event_id)

            # Parse times
            start = event.get('start', {}).get('dateTime') or event.get('start', {}).get('date')
            end = event.get('end', {}).get('dateTime') or event.get('end', {}).get('date')

            try:
                start_dt = datetime.fromisoformat(start) if start else None
                end_dt = datetime.fromisoformat(end) if end else None
            except ValueError:
                continue

            attendees = [a.get('email') for a in event.get('attendees', []) if a.get('email')]

            # Run Matching Logic
            match_result = matcher.match_appointment({
                "summary": summary,
                "attendees": attendees,
            })

            # Nombre del cliente desde cache (sin query — N+1 eliminado).
            client_name = matcher.client_name(match_result['matched_client_id'])

            logger.log_processing_event(event_id, summary)
            logger.log_match_result(
                event_id,
                match_result['match_status'],
                client_name,
                match_result['match_confidence'],
            )

            is_new = existing is None
            is_client_meeting = match_result['match_status'] in ['CONFIRMED', 'PROBABLE']

            if is_new:
                new_appt = Appointment(
                    id=event_id,
                    analyst_email=event_analyst,
                    summary=summary,
                    description=event.get('description'),
                    start_time=start_dt,
                    end_time=end_dt,
                    attendees=attendees,
                    is_client_meeting=is_client_meeting,
                    match_status=match_result['match_status'],
                    match_confidence=match_result['match_confidence'],
                    match_reason=match_result['match_reason'],
                    matched_client_id=match_result['matched_client_id'],
                    category=match_result['category'],
                )
                db.add(new_appt)
                existing_by_id[event_id] = new_appt
            else:
                changed = (
                    existing.summary != summary or
                    existing.start_time != start_dt or
                    existing.end_time != end_dt or
                    existing.match_status != match_result['match_status'] or
                    existing.matched_client_id != match_result['matched_client_id'] or
                    existing.category != match_result['category']
                )
                if changed:
                    existing.summary = summary
                    existing.start_time = start_dt
                    existing.end_time = end_dt
                    existing.match_status = match_result['match_status']
                    existing.matched_client_id = match_result['matched_client_id']
                    existing.match_confidence = match_result['match_confidence']
                    existing.match_reason = match_result['match_reason']
                    existing.is_client_meeting = is_client_meeting
                    existing.category = match_result['category']
                else:
                    logger.metrics["unchanged_appointments"] += 1

            logger.log_db_operation("INSERT" if is_new else "UPDATE", event_id, is_new)

            total_processed += 1
            if is_client_meeting:
                total_matched += 1

        db.commit()
        logger.info("Database commit successful")

        # Sincronización de clínicas que comparten reuniones (config-driven).
        # Antes: ~600 líneas copy-paste. Ahora: una tabla de config + un loop.
        logger.info("=" * 60)
        logger.info("Sincronizando clínicas que comparten reuniones...")
        sync_stats = sync_clinic_groups(db, SYNC_GROUPS)
        db.commit()
        for label, count in sync_stats.items():
            if count:
                logger.info(f"  [{label}] {count} nuevos appointments")
        logger.info(f"Sync total: {sum(sync_stats.values())} nuevos appointments")

        # Métricas finales
        logger.update_metrics(
            total_processed=total_processed,
            total_matched=total_matched,
        )
        logger.end_execution()

    except Exception as e:
        logger.log_error("ETL Failed", e)
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    run_etl()
