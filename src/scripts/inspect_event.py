"""
Script to inspect a specific Google Calendar event
"""
from src.services.gcal import GCalService
from src.config import ANALYST_EMAILS
import json

# Initialize Google Calendar service
gcal = GCalService()

# Event ID to inspect
event_id = "611selpd6idgad9421oqg4fof0"

print(f"\n=== INSPECTING EVENT {event_id} ===\n")

# Try to fetch the event from each analyst's calendar
for analyst_email in ANALYST_EMAILS:
    try:
        print(f"Trying analyst: {analyst_email}")
        # Fetch event from Google Calendar
        event = gcal.service.events().get(
            calendarId=analyst_email,
            eventId=event_id
        ).execute()

        print(f"\n✓ Found event in {analyst_email}'s calendar!")
        print(f"\nTitle: {event.get('summary', 'N/A')}")
        print(f"Start: {event.get('start', {}).get('dateTime', 'N/A')}")
        print(f"Description: {event.get('description', 'N/A')[:200]}")

        # Print attendees
        attendees = event.get('attendees', [])
        print(f"\nAttendees ({len(attendees)}):")
        for i, att in enumerate(attendees, 1):
            email = att.get('email', 'N/A')
            status = att.get('responseStatus', 'N/A')
            print(f"  {i}. {email} (status: {status})")

        if not attendees:
            print("  [NO ATTENDEES]")

        # Print organizer
        organizer = event.get('organizer', {})
        print(f"\nOrganizer: {organizer.get('email', 'N/A')}")

        break

    except Exception as e:
        print(f"  × Not found: {str(e)}")
        continue
else:
    print(f"\n⚠️ Event not found in any analyst calendar")

print("\n" + "=" * 80)
