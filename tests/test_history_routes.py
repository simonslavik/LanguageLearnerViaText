"""Integration tests for /api/history/* routes.

All MongoDB calls are intercepted via patch so no real database is needed.
FastAPI dependency_overrides is used to inject the test user without a real DB.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId

from app.main import app
from app.services.auth import get_current_user
from tests.conftest import async_cursor


@pytest.fixture(autouse=False)
def auth_override(test_user):
    """Override get_current_user to return test_user for the duration of a test."""
    app.dependency_overrides[get_current_user] = lambda: test_user
    yield
    app.dependency_overrides.pop(get_current_user, None)


def _history_doc(user_oid, history_oid=None):
    """Return a minimal history document as Motor would return it."""
    history_oid = history_oid or ObjectId()
    return {
        "_id": history_oid,
        "user_id": user_oid,
        "filename": "sample.pdf",
        "target_lang": "Spanish",
        "target_lang_code": "es",
        "created_at": "2024-01-01T00:00:00",
        "original_text": "Hello world",
        "translated_text": "Hola mundo",
        "sentence_pairs": [],
        "word_map": {},
    }


# ── GET /api/history ──────────────────────────────────────────────────────

class TestListHistory:
    def test_returns_list_for_authenticated_user(
        self, client, mock_db, auth_override, test_user, user_oid
    ):
        doc = _history_doc(user_oid)
        mock_db.history.find = MagicMock(return_value=async_cursor([{
            "_id": doc["_id"],
            "filename": doc["filename"],
            "target_lang": doc["target_lang"],
            "target_lang_code": doc["target_lang_code"],
            "created_at": doc["created_at"],
            "user_id": user_oid,
        }]))

        with patch("app.routes.history.get_db", return_value=mock_db):
            resp = client.get("/api/history")

        assert resp.status_code == 200
        items = resp.json()
        assert isinstance(items, list)
        assert len(items) == 1
        assert items[0]["filename"] == "sample.pdf"

    def test_returns_empty_list_when_no_history(
        self, client, mock_db, auth_override, test_user
    ):
        mock_db.history.find = MagicMock(return_value=async_cursor([]))

        with patch("app.routes.history.get_db", return_value=mock_db):
            resp = client.get("/api/history")

        assert resp.status_code == 200
        assert resp.json() == []

    def test_requires_authentication(self, client):
        resp = client.get("/api/history")
        assert resp.status_code == 401


# ── GET /api/history/{id} ─────────────────────────────────────────────────

class TestGetHistoryItem:
    def test_returns_full_document(
        self, client, mock_db, auth_override, test_user, user_oid
    ):
        history_oid = ObjectId()
        doc = _history_doc(user_oid, history_oid)
        mock_db.history.find_one = AsyncMock(return_value=doc)

        with patch("app.routes.history.get_db", return_value=mock_db):
            resp = client.get(f"/api/history/{str(history_oid)}")

        assert resp.status_code == 200
        data = resp.json()
        assert data["filename"] == "sample.pdf"
        assert "id" in data

    def test_not_found_returns_404(
        self, client, mock_db, auth_override, test_user
    ):
        mock_db.history.find_one = AsyncMock(return_value=None)

        with patch("app.routes.history.get_db", return_value=mock_db):
            resp = client.get(f"/api/history/{str(ObjectId())}")

        assert resp.status_code == 404

    def test_invalid_id_returns_400(
        self, client, mock_db, auth_override, test_user
    ):
        with patch("app.routes.history.get_db", return_value=mock_db):
            resp = client.get("/api/history/not-an-objectid")

        assert resp.status_code == 400

    def test_requires_authentication(self, client):
        resp = client.get(f"/api/history/{str(ObjectId())}")
        assert resp.status_code == 401


# ── DELETE /api/history/{id} ──────────────────────────────────────────────

class TestDeleteHistoryItem:
    def test_delete_existing_item(
        self, client, mock_db, auth_override, test_user
    ):
        mock_db.history.delete_one = AsyncMock(
            return_value=MagicMock(deleted_count=1)
        )

        with patch("app.routes.history.get_db", return_value=mock_db):
            resp = client.delete(f"/api/history/{str(ObjectId())}")

        assert resp.status_code == 200
        assert resp.json()["detail"] == "Deleted"

    def test_delete_missing_item_returns_404(
        self, client, mock_db, auth_override, test_user
    ):
        mock_db.history.delete_one = AsyncMock(
            return_value=MagicMock(deleted_count=0)
        )

        with patch("app.routes.history.get_db", return_value=mock_db):
            resp = client.delete(f"/api/history/{str(ObjectId())}")

        assert resp.status_code == 404

    def test_invalid_id_returns_400(
        self, client, mock_db, auth_override, test_user
    ):
        with patch("app.routes.history.get_db", return_value=mock_db):
            resp = client.delete("/api/history/bad-id")

        assert resp.status_code == 400

    def test_requires_authentication(self, client):
        resp = client.delete(f"/api/history/{str(ObjectId())}")
        assert resp.status_code == 401


# ── DELETE /api/history (clear all) ──────────────────────────────────────

class TestClearHistory:
    def test_clears_all_history(
        self, client, mock_db, auth_override, test_user
    ):
        mock_db.history.delete_many = AsyncMock(return_value=MagicMock())

        with patch("app.routes.history.get_db", return_value=mock_db):
            resp = client.delete("/api/history")

        assert resp.status_code == 200
        assert resp.json()["detail"] == "History cleared"
        mock_db.history.delete_many.assert_awaited_once()

    def test_requires_authentication(self, client):
        resp = client.delete("/api/history")
        assert resp.status_code == 401
