"""Pruebas de la API de NoteSync."""

import os
from datetime import datetime, timedelta, timezone

os.environ["IOS_SECRET"] = "clave-de-prueba"
os.environ["DATABASE_URL"] = "sqlite:///./test_notesync.db"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine

TEST_SECRET = os.environ["IOS_SECRET"]


@pytest.fixture(autouse=True)
def _reset_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client():
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture
def secret_headers():
    return {"X-API-Key": TEST_SECRET}


def make_note(client, title="Comprar leche", when=None, source="samsung"):
    payload = {
        "title": title,
        "body": "recordatorio de mercado",
        "reminder_at": (
            when or datetime.now(timezone.utc) + timedelta(hours=2)
        ).isoformat(),
        "source": source,
    }
    return client.post("/api/notes", json=payload)


def make_ink_note(client, title="A mano", n=3):
    points = [[100 + i * 10, 200 + (i % 2) * 30, 0.8] for i in range(n)]
    payload = {
        "title": title,
        "source": "samsung",
        "ink": {
            "version": 1,
            "page": {"w": 1414, "h": 2000},
            "strokes": [
                {
                    "tool": "pen",
                    "color": "#1e293b",
                    "width": 3,
                    "points": points,
                }
            ],
        },
    }
    return client.post("/api/notes", json=payload)


class TestNotes:
    def test_create_and_list(self, client):
        response = make_note(client)
        assert response.status_code == 201
        assert response.json()["title"] == "Comprar leche"
        assert response.json()["source"] == "samsung"

        listing = client.get("/api/notes")
        assert listing.status_code == 200
        assert len(listing.json()) == 1

    def test_delete_note(self, client):
        note_id = make_note(client).json()["id"]
        assert client.delete(f"/api/notes/{note_id}").status_code == 204
        assert len(client.get("/api/notes").json()) == 0

    def test_validation_title_required(self, client):
        response = client.post("/api/notes", json={"title": ""})
        assert response.status_code == 422


class TestInk:
    def test_create_ink_note_and_list(self, client):
        response = make_ink_note(client)
        assert response.status_code == 201
        data = response.json()
        assert data["ink"]["page"] == {"w": 1414, "h": 2000}
        assert len(data["ink"]["strokes"]) == 1
        assert data["ink"]["strokes"][0]["points"][0] == [100, 200, 0.8]

        listing = client.get("/api/notes")
        assert listing.status_code == 200
        assert len(listing.json()) == 1

    def test_get_single_note(self, client):
        note_id = make_ink_note(client).json()["id"]
        response = client.get(f"/api/notes/{note_id}")
        assert response.status_code == 200
        assert response.json()["title"] == "A mano"
        assert len(response.json()["ink"]["strokes"][0]["points"]) == 3

    def test_patch_updates_ink(self, client):
        note_id = make_ink_note(client, n=3).json()["id"]
        new_points = [[500, 600, 0.2], [520, 640, 0.9]]
        patch = {
            "ink": {
                "version": 1,
                "page": {"w": 1414, "h": 2000},
                "strokes": [
                    {"tool": "pen", "color": "#b91c1c", "width": 5, "points": new_points}
                ],
            }
        }
        response = client.patch(f"/api/notes/{note_id}", json=patch)
        assert response.status_code == 200
        strokes = response.json()["ink"]["strokes"]
        assert strokes[0]["color"] == "#b91c1c"
        assert len(strokes) == 1
        assert strokes[0]["points"] == new_points

    def test_patch_rejects_point_outside_page(self, client):
        note_id = make_ink_note(client, n=1).json()["id"]
        patch = {
            "ink": {
                "version": 1,
                "page": {"w": 1414, "h": 2000},
                "strokes": [{"tool": "pen", "points": [[1500, 500, 0.5]]}],
            }
        }
        assert client.patch(f"/api/notes/{note_id}", json=patch).status_code == 422

    def test_ink_rejects_out_of_range_pressure(self, client):
        payload = {
            "title": "Presion invalida",
            "ink": {
                "version": 1,
                "page": {"w": 1414, "h": 2000},
                "strokes": [{"tool": "pen", "width": 3, "points": [[10, 10, 1.5]]}],
            },
        }
        assert client.post("/api/notes", json=payload).status_code == 422

    def test_ink_rejects_negative_coords(self, client):
        payload = {
            "title": "Coordenada invalida",
            "ink": {
                "version": 1,
                "page": {"w": 1414, "h": 2000},
                "strokes": [{"tool": "pen", "width": 3, "points": [[-5, 10, 0.5]]}],
            },
        }
        assert client.post("/api/notes", json=payload).status_code == 422

    def test_ink_rejects_empty_points(self, client):
        payload = {
            "title": "Sin puntos",
            "ink": {
                "version": 1,
                "page": {"w": 1414, "h": 2000},
                "strokes": [{"tool": "pen", "width": 3, "points": []}],
            },
        }
        assert client.post("/api/notes", json=payload).status_code == 422

    def test_text_note_without_ink_still_works(self, client):
        response = make_note(client)
        assert response.status_code == 201
        assert response.json()["ink"] is None


class TestReminders:
    def test_pending_by_date(self, client):
        today = datetime.now(timezone.utc)
        make_note(client, title="Hoy", when=today + timedelta(hours=1), source="web")
        make_note(client, title="Otro mes", when=today + timedelta(days=45))
        due = (today + timedelta(hours=1)).date().isoformat()
        response = client.get(f"/api/reminders?due={due}")
        assert response.status_code == 200
        titles = [item["title"] for item in response.json()]
        assert "Hoy" in titles
        assert "Otro mes" not in titles

    def test_feed_ics_shape(self, client, secret_headers):
        when = datetime.now(timezone.utc) + timedelta(hours=3)
        make_note(client, title="Clase de piano", when=when)
        response = client.get("/api/feed.ics", headers=secret_headers)
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/calendar")
        assert b"BEGIN:VCALENDAR" in response.content
        assert b"Clase de piano" in response.content

    def test_feed_requires_secret(self, client):
        assert client.get("/api/feed.ics").status_code == 401

    def test_feed_accepts_key_query(self, client):
        when = datetime.now(timezone.utc) + timedelta(hours=3)
        make_note(client, title="Con query key", when=when)
        response = client.get(f"/api/feed.ics?key={TEST_SECRET}")
        assert response.status_code == 200
        assert b"Con query key" in response.content

    def test_patch_reminder_set_and_clear(self, client):
        note_id = make_note(client).json()["id"]
        when = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        response = client.patch(f"/api/notes/{note_id}", json={"reminder_at": when})
        assert response.status_code == 200
        assert response.json()["reminder_at"] is not None
        cleared = client.patch(f"/api/notes/{note_id}", json={"reminder_at": None})
        assert cleared.status_code == 200
        assert cleared.json()["reminder_at"] is None


class TestSecurity:
    def test_mark_synced_requires_secret(self, client):
        note_id = make_note(client).json()["id"]
        response = client.post(f"/api/notes/{note_id}/synced")
        assert response.status_code == 401

    def test_mark_synced_with_wrong_secret(self, client, secret_headers):
        note_id = make_note(client).json()["id"]
        response = client.post(
            f"/api/notes/{note_id}/synced", headers={"X-API-Key": "incorrecto"}
        )
        assert response.status_code == 403

    def test_mark_synced_ok(self, client, secret_headers):
        note_id = make_note(client).json()["id"]
        response = client.post(f"/api/notes/{note_id}/synced", headers=secret_headers)
        assert response.status_code == 200
        assert response.json()["synced_to_ios"] is True


class TestHealth:
    def test_health(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"