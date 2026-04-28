"""Integration tests for /api/auth/* routes.

All MongoDB calls are intercepted via patch so no real database is needed.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId

from app.services.auth import hash_password, create_access_token


# ── /api/auth/register ────────────────────────────────────────────────────

class TestRegister:
    def test_register_success(self, client, mock_db):
        mock_db.users.find_one = AsyncMock(return_value=None)
        mock_db.users.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )

        with patch("app.routes.auth.get_db", return_value=mock_db):
            resp = client.post(
                "/api/auth/register",
                json={"name": "Alice", "email": "alice@test.com", "password": "securepass"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["user"]["email"] == "alice@test.com"
        assert data["user"]["name"] == "Alice"
        assert "password" not in data["user"]

    def test_register_duplicate_email_returns_409(self, client, mock_db, test_user):
        mock_db.users.find_one = AsyncMock(return_value=test_user)

        with patch("app.routes.auth.get_db", return_value=mock_db):
            resp = client.post(
                "/api/auth/register",
                json={"name": "Bob", "email": "test@example.com", "password": "securepass"},
            )

        assert resp.status_code == 409
        assert "already registered" in resp.json()["detail"].lower()

    def test_register_short_password_returns_400(self, client, mock_db):
        mock_db.users.find_one = AsyncMock(return_value=None)

        with patch("app.routes.auth.get_db", return_value=mock_db):
            resp = client.post(
                "/api/auth/register",
                json={"name": "Carol", "email": "carol@test.com", "password": "abc"},
            )

        assert resp.status_code == 400
        assert "6" in resp.json()["detail"]

    def test_register_invalid_email_returns_422(self, client):
        resp = client.post(
            "/api/auth/register",
            json={"name": "Dave", "email": "not-an-email", "password": "securepass"},
        )
        assert resp.status_code == 422

    def test_register_missing_fields_returns_422(self, client):
        resp = client.post("/api/auth/register", json={"email": "x@x.com"})
        assert resp.status_code == 422


# ── /api/auth/login ───────────────────────────────────────────────────────

class TestLogin:
    def test_login_success(self, client, mock_db, test_user):
        mock_db.users.find_one = AsyncMock(return_value=test_user)

        with patch("app.routes.auth.get_db", return_value=mock_db):
            resp = client.post(
                "/api/auth/login",
                json={"email": "test@example.com", "password": "password123"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["user"]["email"] == "test@example.com"

    def test_login_wrong_password_returns_401(self, client, mock_db, test_user):
        mock_db.users.find_one = AsyncMock(return_value=test_user)

        with patch("app.routes.auth.get_db", return_value=mock_db):
            resp = client.post(
                "/api/auth/login",
                json={"email": "test@example.com", "password": "wrongpass"},
            )

        assert resp.status_code == 401
        assert "invalid" in resp.json()["detail"].lower()

    def test_login_unknown_email_returns_401(self, client, mock_db):
        mock_db.users.find_one = AsyncMock(return_value=None)

        with patch("app.routes.auth.get_db", return_value=mock_db):
            resp = client.post(
                "/api/auth/login",
                json={"email": "nobody@test.com", "password": "pass"},
            )

        assert resp.status_code == 401

    def test_login_missing_body_returns_422(self, client):
        resp = client.post("/api/auth/login", json={})
        assert resp.status_code == 422


# ── /api/auth/me ─────────────────────────────────────────────────────────

class TestMe:
    def test_me_with_valid_token(self, client, mock_db, test_user, auth_headers, user_id):
        mock_db.users.find_one = AsyncMock(return_value=test_user)

        with patch("app.services.auth.get_db", return_value=mock_db):
            resp = client.get("/api/auth/me", headers=auth_headers)

        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "test@example.com"
        assert "password" not in data

    def test_me_without_token_returns_401(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_me_with_invalid_token_returns_401(self, client):
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert resp.status_code == 401

    def test_me_with_malformed_header_returns_403(self, client):
        """Malformed (non-Bearer) auth header."""
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": "Basic dXNlcjpwYXNz"},
        )
        # FastAPI HTTPBearer returns 403 for wrong scheme
        assert resp.status_code in (401, 403)
