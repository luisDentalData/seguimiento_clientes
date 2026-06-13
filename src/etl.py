
import sys
import os
from datetime import datetime
from sqlalchemy.orm import Session

# Path hack: Add project root (Seguimiento Clientes) to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database import SessionLocal
from src.config import ANALYST_EMAILS, DEFAULT_START_DATE, DEFAULT_END_DATE
from src.services.gcal import GCalService
from src.services.matching import Matcher
from src.models import Appointment
from src.config import DATABASE_URL
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
        # Query each analyst's calendar directly to get all their events (including future recurring events)
        logger.info(f"Fetching events directly from {len(ANALYST_EMAILS)} analyst calendars...")

        all_events = []
        for analyst_email in ANALYST_EMAILS:
            logger.log_fetching_start(analyst_email)
            try:
                events = gcal.get_events(analyst_email, start_date, end_date)
                logger.log_fetching_result(analyst_email, len(events))
                # Tag each event with the analyst email
                for event in events:
                    event['_analyst_email'] = analyst_email
                all_events.extend(events)
            except Exception as e:
                logger.log_error(f"Could not fetch events from {analyst_email}", e)
                continue

        logger.info(f"Total events from all analysts: {len(all_events)}")

        # Deduplicate events by event_id (same event can appear in multiple calendars)
        # Keep the event from the calendar where the analyst is the organizer
        events_by_id = {}
        for event in all_events:
            event_id = event['id']
            event_analyst = event.get('_analyst_email')
            organizer = event.get('organizer', {}).get('email', '').lower()

            if event_id not in events_by_id:
                events_by_id[event_id] = event
            else:
                # If this analyst is the organizer, prefer this version
                if organizer == event_analyst.lower():
                    events_by_id[event_id] = event

        unique_events = list(events_by_id.values())
        logger.info(f"Unique events (after deduplication): {len(unique_events)}")

        # Process all unique events
        for event in unique_events:
            event_analyst = event.get('_analyst_email')
            event_id = event['id']
            summary = event.get('summary', 'No Title')

            # Check for existing
            existing = db.query(Appointment).filter(Appointment.id == event_id).first()

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
            appointment_data = {
                "summary": summary,
                "attendees": attendees
            }
            match_result = matcher.match_appointment(appointment_data)

            # Log matching result
            client_name = None
            if match_result['matched_client_id']:
                from src.models import Client
                client = db.query(Client).filter(Client.id == match_result['matched_client_id']).first()
                client_name = client.name if client else None

            logger.log_processing_event(event_id, summary)
            logger.log_match_result(
                event_id,
                match_result['match_status'],
                client_name,
                match_result['match_confidence']
            )

            is_new = not existing

            if not existing:
                new_appt = Appointment(
                    id=event_id,
                    analyst_email=event_analyst,
                    summary=summary,
                    description=event.get('description'),
                    start_time=start_dt,
                    end_time=end_dt,
                    attendees=attendees,
                    is_client_meeting = (match_result['match_status'] in ['CONFIRMED', 'PROBABLE']),
                    match_status=match_result['match_status'],
                    match_confidence=match_result['match_confidence'],
                    match_reason=match_result['match_reason'],
                    matched_client_id=match_result['matched_client_id']
                )
                db.add(new_appt)
            else:
                # Detect if anything actually changed
                changed = (
                    existing.summary != summary or
                    existing.start_time != start_dt or
                    existing.end_time != end_dt or
                    existing.match_status != match_result['match_status'] or
                    existing.matched_client_id != match_result['matched_client_id']
                )

                if changed:
                    # Update existing - re-run matching to ensure latest logic is applied
                    existing.summary = summary
                    existing.start_time = start_dt
                    existing.end_time = end_dt
                    existing.match_status = match_result['match_status']
                    existing.matched_client_id = match_result['matched_client_id']
                    existing.match_confidence = match_result['match_confidence']
                    existing.match_reason = match_result['match_reason']
                    existing.is_client_meeting = (match_result['match_status'] in ['CONFIRMED', 'PROBABLE'])
                else:
                    # No changes detected
                    logger.metrics["unchanged_appointments"] += 1

            logger.log_db_operation("INSERT" if is_new else "UPDATE", event_id, is_new)

            total_processed += 1
            if match_result['match_status'] in ['CONFIRMED', 'PROBABLE']:
                total_matched += 1

        db.commit()
        logger.info("Database commit successful")

        # SPECIAL CASE: Sync Amelar clinics
        # Both "amelar bellavista" (DD-00018) and "amelar sevilla este" (DD-00045)
        # share the same meetings, so we duplicate appointments for both
        logger.info("=" * 60)
        logger.info("Syncing Amelar clinics...")

        amelar_bellavista_appointments = db.query(Appointment).filter(
            Appointment.matched_client_id == 'DD-00018'
        ).all()

        amelar_synced = 0
        for appt in amelar_bellavista_appointments:
            # Create duplicate ID for sevilla este
            sevilla_este_id = f"{appt.id}_DD-00045"

            # Check if already exists
            existing_sevilla = db.query(Appointment).filter(
                Appointment.id == sevilla_este_id
            ).first()

            if existing_sevilla:
                # Update existing
                existing_sevilla.matched_client_id = 'DD-00045'
                existing_sevilla.summary = appt.summary
                existing_sevilla.start_time = appt.start_time
                existing_sevilla.end_time = appt.end_time
                existing_sevilla.is_client_meeting = appt.is_client_meeting
                existing_sevilla.match_status = appt.match_status
                existing_sevilla.match_confidence = appt.match_confidence
                existing_sevilla.match_reason = f'[AMELAR SEVILLA ESTE] {appt.match_reason}'
            else:
                # Create new
                new_sevilla_appt = Appointment(
                    id=sevilla_este_id,
                    analyst_email=appt.analyst_email,
                    summary=appt.summary,
                    description=appt.description,
                    start_time=appt.start_time,
                    end_time=appt.end_time,
                    attendees=appt.attendees,
                    is_client_meeting=appt.is_client_meeting,
                    match_status=appt.match_status,
                    match_confidence=appt.match_confidence,
                    match_reason=f'[AMELAR SEVILLA ESTE] {appt.match_reason}',
                    matched_client_id='DD-00045'
                )
                db.add(new_sevilla_appt)
                amelar_synced += 1

        db.commit()
        logger.log_sync_operation("Amelar", "DD-00018 (Bellavista)", 1, amelar_synced)

        # SPECIAL CASE: Sync Junyent clinics
        # Both "junyent manresa" (DD-00078) and "junyent smile" (DD-00089)
        # share the same meetings, so we duplicate appointments for both
        print("\n" + "="*30)
        print("Syncing Junyent clinics...")

        junyent_manresa_appointments = db.query(Appointment).filter(
            Appointment.matched_client_id == 'DD-00078'
        ).all()

        junyent_synced = 0
        for appt in junyent_manresa_appointments:
            # Create duplicate ID for junyent smile
            smile_id = f"{appt.id}_DD-00089"

            # Check if already exists
            existing_smile = db.query(Appointment).filter(
                Appointment.id == smile_id
            ).first()

            if existing_smile:
                # Update existing
                existing_smile.matched_client_id = 'DD-00089'
                existing_smile.summary = appt.summary
                existing_smile.start_time = appt.start_time
                existing_smile.end_time = appt.end_time
                existing_smile.is_client_meeting = appt.is_client_meeting
                existing_smile.match_status = appt.match_status
                existing_smile.match_confidence = appt.match_confidence
                existing_smile.match_reason = f'[JUNYENT SMILE] {appt.match_reason}'
            else:
                # Create new
                new_smile_appt = Appointment(
                    id=smile_id,
                    analyst_email=appt.analyst_email,
                    summary=appt.summary,
                    description=appt.description,
                    start_time=appt.start_time,
                    end_time=appt.end_time,
                    attendees=appt.attendees,
                    is_client_meeting=appt.is_client_meeting,
                    match_status=appt.match_status,
                    match_confidence=appt.match_confidence,
                    match_reason=f'[JUNYENT SMILE] {appt.match_reason}',
                    matched_client_id='DD-00089'
                )
                db.add(new_smile_appt)
                junyent_synced += 1

        db.commit()
        print(f"Junyent synced: {junyent_synced} new appointments for Smile")

        # SPECIAL CASE: Sync Almidental clinics
        # Both "almidental pedreguer" (DD-00008) and "almidental ondara" (DD-00126)
        # share the same meetings, so we duplicate appointments for both
        print("\n" + "="*30)
        print("Syncing Almidental clinics...")

        almidental_pedreguer_appointments = db.query(Appointment).filter(
            Appointment.matched_client_id == 'DD-00008'
        ).all()

        almidental_synced = 0
        for appt in almidental_pedreguer_appointments:
            # Create duplicate ID for almidental ondara
            ondara_id = f"{appt.id}_DD-00126"

            # Check if already exists
            existing_ondara = db.query(Appointment).filter(
                Appointment.id == ondara_id
            ).first()

            if existing_ondara:
                # Update existing
                existing_ondara.matched_client_id = 'DD-00126'
                existing_ondara.summary = appt.summary
                existing_ondara.start_time = appt.start_time
                existing_ondara.end_time = appt.end_time
                existing_ondara.is_client_meeting = appt.is_client_meeting
                existing_ondara.match_status = appt.match_status
                existing_ondara.match_confidence = appt.match_confidence
                existing_ondara.match_reason = f'[ALMIDENTAL ONDARA] {appt.match_reason}'
            else:
                # Create new
                new_ondara_appt = Appointment(
                    id=ondara_id,
                    analyst_email=appt.analyst_email,
                    summary=appt.summary,
                    description=appt.description,
                    start_time=appt.start_time,
                    end_time=appt.end_time,
                    attendees=appt.attendees,
                    is_client_meeting=appt.is_client_meeting,
                    match_status=appt.match_status,
                    match_confidence=appt.match_confidence,
                    match_reason=f'[ALMIDENTAL ONDARA] {appt.match_reason}',
                    matched_client_id='DD-00126'
                )
                db.add(new_ondara_appt)
                almidental_synced += 1

        db.commit()
        print(f"Almidental synced: {almidental_synced} new appointments for Ondara")

        # SPECIAL CASE: Sync Smilodon clinics
        # Both "smilodon getafe" (DD-00112) and "smilodon madrid" (DD-00113)
        # share the same meetings, so we duplicate appointments for both
        print("\n" + "="*30)
        print("Syncing Smilodon clinics...")

        smilodon_getafe_appointments = db.query(Appointment).filter(
            Appointment.matched_client_id == 'DD-00112'
        ).all()

        smilodon_synced = 0
        for appt in smilodon_getafe_appointments:
            # Create duplicate ID for smilodon madrid
            madrid_id = f"{appt.id}_DD-00113"

            # Check if already exists
            existing_madrid = db.query(Appointment).filter(
                Appointment.id == madrid_id
            ).first()

            if existing_madrid:
                # Update existing
                existing_madrid.matched_client_id = 'DD-00113'
                existing_madrid.summary = appt.summary
                existing_madrid.start_time = appt.start_time
                existing_madrid.end_time = appt.end_time
                existing_madrid.is_client_meeting = appt.is_client_meeting
                existing_madrid.match_status = appt.match_status
                existing_madrid.match_confidence = appt.match_confidence
                existing_madrid.match_reason = f'[SMILODON MADRID] {appt.match_reason}'
            else:
                # Create new
                new_madrid_appt = Appointment(
                    id=madrid_id,
                    analyst_email=appt.analyst_email,
                    summary=appt.summary,
                    description=appt.description,
                    start_time=appt.start_time,
                    end_time=appt.end_time,
                    attendees=appt.attendees,
                    is_client_meeting=appt.is_client_meeting,
                    match_status=appt.match_status,
                    match_confidence=appt.match_confidence,
                    match_reason=f'[SMILODON MADRID] {appt.match_reason}',
                    matched_client_id='DD-00113'
                )
                db.add(new_madrid_appt)
                smilodon_synced += 1

        db.commit()
        print(f"Smilodon synced: {smilodon_synced} new appointments for Madrid")

        # SPECIAL CASE: Sync Garantia clinics
        # Both "garantia dental ayala" (DD-00080) and "garantia dental quintana" (DD-00081)
        # share the same meetings, so we duplicate appointments for both
        print("\n" + "="*30)
        print("Syncing Garantia clinics...")

        garantia_ayala_appointments = db.query(Appointment).filter(
            Appointment.matched_client_id == 'DD-00080'
        ).all()

        garantia_synced = 0
        for appt in garantia_ayala_appointments:
            # Create duplicate ID for garantia quintana
            quintana_id = f"{appt.id}_DD-00081"

            # Check if already exists
            existing_quintana = db.query(Appointment).filter(
                Appointment.id == quintana_id
            ).first()

            if existing_quintana:
                # Update existing
                existing_quintana.matched_client_id = 'DD-00081'
                existing_quintana.summary = appt.summary
                existing_quintana.start_time = appt.start_time
                existing_quintana.end_time = appt.end_time
                existing_quintana.is_client_meeting = appt.is_client_meeting
                existing_quintana.match_status = appt.match_status
                existing_quintana.match_confidence = appt.match_confidence
                existing_quintana.match_reason = f'[GARANTIA QUINTANA] {appt.match_reason}'
            else:
                # Create new
                new_quintana_appt = Appointment(
                    id=quintana_id,
                    analyst_email=appt.analyst_email,
                    summary=appt.summary,
                    description=appt.description,
                    start_time=appt.start_time,
                    end_time=appt.end_time,
                    attendees=appt.attendees,
                    is_client_meeting=appt.is_client_meeting,
                    match_status=appt.match_status,
                    match_confidence=appt.match_confidence,
                    match_reason=f'[GARANTIA QUINTANA] {appt.match_reason}',
                    matched_client_id='DD-00081'
                )
                db.add(new_quintana_appt)
                garantia_synced += 1

        db.commit()
        print(f"Garantia synced: {garantia_synced} new appointments for Quintana")

        # SPECIAL CASE: Sync Maxal clinics
        # Both "maxal medicos getxo" (DD-00010) and "maxal medicos bilbao" (DD-00116)
        # share the same meetings, so we duplicate appointments for both
        print("\n" + "="*30)
        print("Syncing Maxal clinics...")

        maxal_getxo_appointments = db.query(Appointment).filter(
            Appointment.matched_client_id == 'DD-00010'
        ).all()

        maxal_synced = 0
        for appt in maxal_getxo_appointments:
            # Create duplicate ID for maxal bilbao
            bilbao_id = f"{appt.id}_DD-00116"

            # Check if already exists
            existing_bilbao = db.query(Appointment).filter(
                Appointment.id == bilbao_id
            ).first()

            if existing_bilbao:
                # Update existing
                existing_bilbao.matched_client_id = 'DD-00116'
                existing_bilbao.summary = appt.summary
                existing_bilbao.start_time = appt.start_time
                existing_bilbao.end_time = appt.end_time
                existing_bilbao.is_client_meeting = appt.is_client_meeting
                existing_bilbao.match_status = appt.match_status
                existing_bilbao.match_confidence = appt.match_confidence
                existing_bilbao.match_reason = f'[MAXAL BILBAO] {appt.match_reason}'
            else:
                # Create new
                new_bilbao_appt = Appointment(
                    id=bilbao_id,
                    analyst_email=appt.analyst_email,
                    summary=appt.summary,
                    description=appt.description,
                    start_time=appt.start_time,
                    end_time=appt.end_time,
                    attendees=appt.attendees,
                    is_client_meeting=appt.is_client_meeting,
                    match_status=appt.match_status,
                    match_confidence=appt.match_confidence,
                    match_reason=f'[MAXAL BILBAO] {appt.match_reason}',
                    matched_client_id='DD-00116'
                )
                db.add(new_bilbao_appt)
                maxal_synced += 1

        db.commit()
        print(f"Maxal synced: {maxal_synced} new appointments for Bilbao")

        # SPECIAL CASE: Sync Triana clinics
        # Both "triana 2" (DD-00014) and "triana 1" (DD-00015)
        # share the same meetings, so we duplicate appointments for both
        print("\n" + "="*30)
        print("Syncing Triana clinics...")

        triana2_appointments = db.query(Appointment).filter(
            Appointment.matched_client_id == 'DD-00014'
        ).all()

        triana_synced = 0
        for appt in triana2_appointments:
            # Create duplicate ID for triana 1
            triana1_id = f"{appt.id}_DD-00015"

            # Check if already exists
            existing_triana1 = db.query(Appointment).filter(
                Appointment.id == triana1_id
            ).first()

            if existing_triana1:
                # Update existing
                existing_triana1.matched_client_id = 'DD-00015'
                existing_triana1.summary = appt.summary
                existing_triana1.start_time = appt.start_time
                existing_triana1.end_time = appt.end_time
                existing_triana1.is_client_meeting = appt.is_client_meeting
                existing_triana1.match_status = appt.match_status
                existing_triana1.match_confidence = appt.match_confidence
                existing_triana1.match_reason = f'[TRIANA 1] {appt.match_reason}'
            else:
                # Create new
                new_triana1_appt = Appointment(
                    id=triana1_id,
                    analyst_email=appt.analyst_email,
                    summary=appt.summary,
                    description=appt.description,
                    start_time=appt.start_time,
                    end_time=appt.end_time,
                    attendees=appt.attendees,
                    is_client_meeting=appt.is_client_meeting,
                    match_status=appt.match_status,
                    match_confidence=appt.match_confidence,
                    match_reason=f'[TRIANA 1] {appt.match_reason}',
                    matched_client_id='DD-00015'
                )
                db.add(new_triana1_appt)
                triana_synced += 1

        db.commit()
        print(f"Triana synced: {triana_synced} new appointments for Triana 1")

        # Also sync Triana 1 -> Triana 2 (bidirectional)
        triana1_appointments = db.query(Appointment).filter(
            Appointment.matched_client_id == 'DD-00015',
            ~Appointment.id.like('%_DD-%')  # Exclude already synced appointments
        ).all()

        triana_synced_reverse = 0
        for appt in triana1_appointments:
            # Create duplicate ID for triana 2
            triana2_id = f"{appt.id}_DD-00014"

            # Check if already exists
            existing_triana2 = db.query(Appointment).filter(
                Appointment.id == triana2_id
            ).first()

            if existing_triana2:
                # Update existing
                existing_triana2.matched_client_id = 'DD-00014'
                existing_triana2.summary = appt.summary
                existing_triana2.start_time = appt.start_time
                existing_triana2.end_time = appt.end_time
                existing_triana2.is_client_meeting = appt.is_client_meeting
                existing_triana2.match_status = appt.match_status
                existing_triana2.match_confidence = appt.match_confidence
                existing_triana2.match_reason = f'[TRIANA 2] {appt.match_reason}'
            else:
                # Create new
                new_triana2_appt = Appointment(
                    id=triana2_id,
                    analyst_email=appt.analyst_email,
                    summary=appt.summary,
                    description=appt.description,
                    start_time=appt.start_time,
                    end_time=appt.end_time,
                    attendees=appt.attendees,
                    is_client_meeting=appt.is_client_meeting,
                    match_status=appt.match_status,
                    match_confidence=appt.match_confidence,
                    match_reason=f'[TRIANA 2] {appt.match_reason}',
                    matched_client_id='DD-00014'
                )
                db.add(new_triana2_appt)
                triana_synced_reverse += 1

        db.commit()
        print(f"Triana synced (reverse): {triana_synced_reverse} new appointments for Triana 2")

        # SPECIAL CASE: Sync Rull clinics
        # Both "rull rota" (DD-00128) and "rull sevilla" (DD-00129)
        # share the same meetings, so we duplicate appointments for both
        print("\n" + "="*30)
        print("Syncing Rull clinics...")

        rull_rota_appointments = db.query(Appointment).filter(
            Appointment.matched_client_id == 'DD-00128'
        ).all()

        rull_synced = 0
        for appt in rull_rota_appointments:
            # Create duplicate ID for rull sevilla
            sevilla_id = f"{appt.id}_DD-00129"

            # Check if already exists
            existing_sevilla = db.query(Appointment).filter(
                Appointment.id == sevilla_id
            ).first()

            if existing_sevilla:
                # Update existing
                existing_sevilla.matched_client_id = 'DD-00129'
                existing_sevilla.summary = appt.summary
                existing_sevilla.start_time = appt.start_time
                existing_sevilla.end_time = appt.end_time
                existing_sevilla.is_client_meeting = appt.is_client_meeting
                existing_sevilla.match_status = appt.match_status
                existing_sevilla.match_confidence = appt.match_confidence
                existing_sevilla.match_reason = f'[RULL SEVILLA] {appt.match_reason}'
            else:
                # Create new
                new_sevilla_appt = Appointment(
                    id=sevilla_id,
                    analyst_email=appt.analyst_email,
                    summary=appt.summary,
                    description=appt.description,
                    start_time=appt.start_time,
                    end_time=appt.end_time,
                    attendees=appt.attendees,
                    is_client_meeting=appt.is_client_meeting,
                    match_status=appt.match_status,
                    match_confidence=appt.match_confidence,
                    match_reason=f'[RULL SEVILLA] {appt.match_reason}',
                    matched_client_id='DD-00129'
                )
                db.add(new_sevilla_appt)
                rull_synced += 1

        db.commit()
        print(f"Rull synced: {rull_synced} new appointments for Sevilla")

        # SPECIAL CASE: Sync Elite clinics
        # All 7 Elite clinics share the same meetings
        # DD-00070 (elite alcala i canovas) is the source
        # Sync to: DD-00071, DD-00072, DD-00073, DD-00074, DD-00075, DD-00076
        print("\n" + "="*30)
        print("Syncing Elite clinics...")

        elite_source_appointments = db.query(Appointment).filter(
            Appointment.matched_client_id == 'DD-00070'
        ).all()

        elite_targets = {
            'DD-00071': 'ELITE LOPEZ FIGUEROA',
            'DD-00072': 'ELITE ANTEQUERA',
            'DD-00073': 'ELITE CASTELLANA',
            'DD-00074': 'ELITE COSLADA',
            'DD-00075': 'ELITE LAS ROZAS',
            'DD-00076': 'ELITE LEGANES'
        }

        total_elite_synced = 0
        for target_id, target_name in elite_targets.items():
            synced_count = 0
            for appt in elite_source_appointments:
                # Create duplicate ID for target clinic
                target_appt_id = f"{appt.id}_{target_id}"

                # Check if already exists
                existing_target = db.query(Appointment).filter(
                    Appointment.id == target_appt_id
                ).first()

                if existing_target:
                    # Update existing
                    existing_target.matched_client_id = target_id
                    existing_target.summary = appt.summary
                    existing_target.start_time = appt.start_time
                    existing_target.end_time = appt.end_time
                    existing_target.is_client_meeting = appt.is_client_meeting
                    existing_target.match_status = appt.match_status
                    existing_target.match_confidence = appt.match_confidence
                    existing_target.match_reason = f'[{target_name}] {appt.match_reason}'
                else:
                    # Create new
                    new_target_appt = Appointment(
                        id=target_appt_id,
                        analyst_email=appt.analyst_email,
                        summary=appt.summary,
                        description=appt.description,
                        start_time=appt.start_time,
                        end_time=appt.end_time,
                        attendees=appt.attendees,
                        is_client_meeting=appt.is_client_meeting,
                        match_status=appt.match_status,
                        match_confidence=appt.match_confidence,
                        match_reason=f'[{target_name}] {appt.match_reason}',
                        matched_client_id=target_id
                    )
                    db.add(new_target_appt)
                    synced_count += 1

            total_elite_synced += synced_count
            db.commit()
            print(f"  {target_name}: {synced_count} new appointments")

        print(f"Elite total synced: {total_elite_synced} new appointments across 6 clinics")

        # SPECIAL CASE: Sync Corral&Vargas clinics
        # DD-00145 (Granada Norte) is the source
        # Targets: DD-00146 (Jaén El Corte Inglés), DD-00147 (Granada Sur)
        print("\n" + "="*30)
        print("Syncing Corral&Vargas clinics...")
        corralvargas_source_appointments = db.query(Appointment).filter(
            Appointment.matched_client_id == 'DD-00145',
            ~Appointment.id.like('%_DD-%')  # Exclude already synced appointments
        ).all()

        corralvargas_targets = {
            'DD-00146': 'CORRAL VARGAS JAEN',
            'DD-00147': 'CORRAL VARGAS GRANADA SUR',
        }

        total_corralvargas_synced = 0
        for target_id, target_name in corralvargas_targets.items():
            synced_count = 0
            for appt in corralvargas_source_appointments:
                target_appt_id = f"{appt.id}_{target_id}"
                existing_target = db.query(Appointment).filter(
                    Appointment.id == target_appt_id
                ).first()

                if existing_target:
                    existing_target.matched_client_id = target_id
                    existing_target.summary = appt.summary
                    existing_target.start_time = appt.start_time
                    existing_target.end_time = appt.end_time
                    existing_target.is_client_meeting = appt.is_client_meeting
                    existing_target.match_status = appt.match_status
                    existing_target.match_confidence = appt.match_confidence
                    existing_target.match_reason = f'[{target_name}] {appt.match_reason}'
                else:
                    new_target_appt = Appointment(
                        id=target_appt_id,
                        analyst_email=appt.analyst_email,
                        summary=appt.summary,
                        description=appt.description,
                        start_time=appt.start_time,
                        end_time=appt.end_time,
                        attendees=appt.attendees,
                        is_client_meeting=appt.is_client_meeting,
                        match_status=appt.match_status,
                        match_confidence=appt.match_confidence,
                        match_reason=f'[{target_name}] {appt.match_reason}',
                        matched_client_id=target_id
                    )
                    db.add(new_target_appt)
                    synced_count += 1

            db.commit()
            print(f"  {target_name}: {synced_count} new appointments")

        print(f"Corral&Vargas total synced: {total_corralvargas_synced} new appointments across 2 clinics")

        # Actualizar métricas finales
        logger.update_metrics(
            total_processed=total_processed,
            total_matched=total_matched
        )

        # Finalizar ejecución y generar resumen
        logger.end_execution()

    except Exception as e:
        logger.log_error("ETL Failed", e)
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    run_etl()
