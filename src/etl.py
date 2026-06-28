
import sys
import os
import threading
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# Path hack: Add project root (Seguimiento Clientes) to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database import SessionLocal
from src.config import ANALYST_EMAILS, DEFAULT_START_DATE, DEFAULT_END_DATE, IMPERSONATE_EMAIL
from src.services.gcal import GCalService
from src.services.matching import Matcher
from src.services.clinic_sync import sync_clinic_groups, build_groups_from_db
from src.services.analyst_admin import active_analyst_emails
from src.models import Appointment
from src.etl_logger import ETLLogger
from sqlalchemy.dialects.postgresql import insert as pg_insert

BATCH_SIZE = 500


def run_etl() -> dict:
    logger = ETLLogger(log_dir="logs")
    logger.start_execution()

    db = SessionLocal()

    try:
        matcher = Matcher(db)

        start_date = datetime.fromisoformat(DEFAULT_START_DATE.replace('Z', '+00:00'))
        end_date = datetime.fromisoformat(DEFAULT_END_DATE.replace('Z', '+00:00'))

        analyst_emails = active_analyst_emails(db) or ANALYST_EMAILS
        logger.info(f"Fetching events from {len(analyst_emails)} analyst calendars in parallel...")

        all_events: list = []
        lock = threading.Lock()

        def fetch_analyst(email: str) -> list:
            # Each thread needs its own GCalService (its own HTTP transport).
            # Sharing one service across threads causes mixed responses and broken
            # pagination — confirmed by u.barroso getting 0 events in parallel run.
            thread_gcal = GCalService(impersonate_email=IMPERSONATE_EMAIL)
            logger.log_fetching_start(email)
            try:
                events = thread_gcal.get_events(email, start_date, end_date)
                logger.log_fetching_result(email, len(events))
                for event in events:
                    event['_analyst_email'] = email
                return events
            except Exception as e:
                logger.log_error(f"Could not fetch events from {email}", e)
                return []

        with ThreadPoolExecutor(max_workers=len(analyst_emails)) as executor:
            futures = {executor.submit(fetch_analyst, email): email for email in analyst_emails}
            for future in as_completed(futures):
                events = future.result()
                with lock:
                    all_events.extend(events)

        logger.info(f"Total events from all analysts: {len(all_events)}")

        # Deduplicate by event_id; prefer the organizer's copy.
        events_by_id: dict = {}
        for event in all_events:
            event_id = event['id']
            event_analyst = event.get('_analyst_email', '')
            organizer = event.get('organizer', {}).get('email', '').lower()
            if event_id not in events_by_id or organizer == event_analyst.lower():
                events_by_id[event_id] = event

        unique_events = list(events_by_id.values())
        logger.info(f"Unique events (after deduplication): {len(unique_events)}")

        # In-memory matching (Matcher caches all clients — no per-event DB query).
        logger.info("Matching events to clients...")
        rows_to_upsert: list = []
        total_matched = 0
        now = datetime.utcnow()

        for event in unique_events:
            event_analyst = event.get('_analyst_email')
            event_id = event['id']
            summary = event.get('summary', 'No Title')

            start = event.get('start', {}).get('dateTime') or event.get('start', {}).get('date')
            end = event.get('end', {}).get('dateTime') or event.get('end', {}).get('date')

            try:
                start_dt = datetime.fromisoformat(start) if start else None
                end_dt = datetime.fromisoformat(end) if end else None
            except ValueError:
                continue

            attendees = [a.get('email') for a in event.get('attendees', []) if a.get('email')]

            match_result = matcher.match_appointment({
                "summary": summary,
                "attendees": attendees,
            })

            is_client_meeting = match_result['match_status'] in ['CONFIRMED', 'PROBABLE']
            if is_client_meeting:
                total_matched += 1

            rows_to_upsert.append({
                'id': event_id,
                'analyst_email': event_analyst,
                'summary': summary,
                'description': event.get('description'),
                'start_time': start_dt,
                'end_time': end_dt,
                'attendees': attendees,
                'is_client_meeting': is_client_meeting,
                'match_status': match_result['match_status'],
                'match_confidence': match_result['match_confidence'],
                'match_reason': match_result['match_reason'],
                'matched_client_id': match_result['matched_client_id'],
                'category': match_result.get('category'),
                'created_at': now,
                'updated_at': now,
            })

        logger.info(f"Matching done: {len(rows_to_upsert)} events, {total_matched} matched to clients")

        # Bulk upsert via PostgreSQL INSERT ... ON CONFLICT DO UPDATE.
        # One round-trip per BATCH_SIZE rows instead of one per row — critical for
        # cross-region Cloud SQL (europe-southwest1 from us-central1).
        total_batches = max(1, (len(rows_to_upsert) + BATCH_SIZE - 1) // BATCH_SIZE)
        for i in range(0, len(rows_to_upsert), BATCH_SIZE):
            batch = rows_to_upsert[i:i + BATCH_SIZE]
            batch_num = i // BATCH_SIZE + 1

            stmt = pg_insert(Appointment.__table__).values(batch)
            stmt = stmt.on_conflict_do_update(
                index_elements=['id'],
                set_={
                    'summary': stmt.excluded.summary,
                    'start_time': stmt.excluded.start_time,
                    'end_time': stmt.excluded.end_time,
                    'attendees': stmt.excluded.attendees,
                    'match_status': stmt.excluded.match_status,
                    'match_confidence': stmt.excluded.match_confidence,
                    'match_reason': stmt.excluded.match_reason,
                    'matched_client_id': stmt.excluded.matched_client_id,
                    'is_client_meeting': stmt.excluded.is_client_meeting,
                    'category': stmt.excluded.category,
                    'updated_at': stmt.excluded.updated_at,
                }
            )
            db.execute(stmt)
            db.commit()
            logger.info(f"Batch {batch_num}/{total_batches}: {len(batch)} appointments upserted")

        # Clinic group synchronization (config-driven, no copy-paste).
        logger.info("=" * 60)
        logger.info("Sincronizando clínicas que comparten reuniones...")
        sync_stats = sync_clinic_groups(db, build_groups_from_db(db))
        db.commit()
        for label, count in sync_stats.items():
            if count:
                logger.info(f"  [{label}] {count} nuevos appointments")
        logger.info(f"Sync total: {sum(sync_stats.values())} nuevos appointments")

        logger.update_metrics(
            total_processed=len(rows_to_upsert),
            total_matched=total_matched,
        )
        logger.end_execution()

        return {
            "total_fetched": len(all_events),
            "unique_events": len(unique_events),
            "total_matched": total_matched,
            "batches_committed": total_batches,
        }

    except Exception as e:
        logger.log_error("ETL Failed", e)
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_etl()
