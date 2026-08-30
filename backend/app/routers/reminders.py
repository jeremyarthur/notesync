"""Endpoints de recordatorios para iPhone e iCalendar/WebCal."""

from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from icalendar import Calendar, Event
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import Note
from ..routers.notes import sync_secret
from ..schemas import ReminderOut

router = APIRouter(prefix="/api", tags=["reminders"])


@router.get("/reminders", response_model=list[ReminderOut])
def pending_reminders(
    due: date | None = None,
    db: Session = Depends(get_db),
) -> list[ReminderOut]:
    """Pendientes para 'hoy' (usado por el Atajo de iOS)."""
    start = datetime.combine(due or date.today(), time.min, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    rows = db.scalars(
        select(Note)
        .where(Note.reminder_at.is_not(None))
        .where(Note.reminder_at >= start)
        .where(Note.reminder_at < end)
        .order_by(Note.reminder_at)
    ).all()
    return [
        ReminderOut(
            id=note.id,
            title=note.title,
            body=note.body,
            reminder_at=note.reminder_at,
            source=note.source,
        )
        for note in rows
    ]


@router.get("/feed.ics")
def calendar_feed(
    _: None = Depends(sync_secret),
    db: Session = Depends(get_db),
) -> Response:
    """Feed WebCal para suscribirse desde la app Calendario de Apple.

    Suscribirse agregar los recordatorios pendientes como eventos y
    se refrescan automaticamente cada cierto tiempo.
    """
    cal = Calendar()
    cal.add("prodid", "-//NoteSync//ES//")
    cal.add("version", "2.0")
    cal.add("X-WR-CALNAME", "NoteSync - Recordatorios")

    for note in db.scalars(
        select(Note).where(Note.reminder_at.is_not(None)).order_by(Note.reminder_at)
    ):
        event = Event()
        event.add("summary", note.title)
        if note.body:
            event.add("description", note.body)
        event.add("dtstart", note.reminder_at)
        event.add("dtend", note.reminder_at + timedelta(minutes=15))
        event.add("uid", f"notesync-{note.id}@notesync.local")
        cal.add_component(event)

    ics = cal.to_ical()
    return Response(
        content=ics,
        media_type="text/calendar",
        headers={"Content-Disposition": 'attachment; filename="notesync.ics"'},
    )