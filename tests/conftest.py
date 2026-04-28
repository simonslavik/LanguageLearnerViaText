"""Shared pytest fixtures for the PDF Translator test suite.

These fixtures provide:
- A session-scoped FastAPI TestClient with DB startup suppressed
- A per-test mock Motor database
- JWT auth helpers
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from bson import ObjectId

from app.services.auth import create_access_token, hash_password


# ── Async iteration helper ────────────────────────────────────────────────

class _AsyncIter:
    """Wrap a plain list as an async-iterable (mimics a Motor cursor)."""

    def __init__(self, items):
        self._items = iter(items)

    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            return next(self._items)
        except StopIteration:
            raise StopAsyncIteration


def async_cursor(items=None):
    """Return a MagicMock whose .sort() yields *items* async-iterably."""
    cursor = MagicMock()
    cursor.sort.return_value = _AsyncIter(items or [])
    return cursor


# ── DB mock factory ───────────────────────────────────────────────────────

def make_mock_db():
    """Build a fresh mock Motor database for each test."""
    db = MagicMock(name="mock_db")

    # users collection
    db.users.find_one = AsyncMock(return_value=None)
    db.users.insert_one = AsyncMock()
    db.users.create_index = AsyncMock()

    # history collection
    db.history.find = MagicMock(return_value=async_cursor())
    db.history.find_one = AsyncMock(return_value=None)
    db.history.insert_one = AsyncMock()
    db.history.delete_one = AsyncMock()
    db.history.delete_many = AsyncMock()
    db.history.create_index = AsyncMock()

    return db


@pytest.fixture
def mock_db():
    """Per-test mock Motor database."""
    return make_mock_db()


# ── Test client ───────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def client():
    """Session-scoped FastAPI TestClient with DB startup/shutdown suppressed."""
    from app.main import app

    with patch("app.main.connect_db", new_callable=AsyncMock), \
         patch("app.main.close_db", new_callable=AsyncMock):
        with TestClient(app) as c:
            yield c


# ── Auth helpers ──────────────────────────────────────────────────────────

@pytest.fixture
def user_oid():
    return ObjectId()


@pytest.fixture
def user_id(user_oid):
    return str(user_oid)


@pytest.fixture
def test_user(user_oid):
    return {
        "_id": user_oid,
        "name": "Test User",
        "email": "test@example.com",
        "password": hash_password("password123"),
    }


@pytest.fixture
def auth_token(user_id):
    return create_access_token(user_id, "test@example.com")


@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}
