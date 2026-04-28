"""Unit tests for app/services/auth.py.

Tests cover password hashing, JWT creation/decoding, and edge cases
without requiring a live database or HTTP client.
"""

import asyncio
import pytest
from datetime import timedelta
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi import HTTPException
from jose import jwt
from bson import ObjectId

from app.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_token,
    get_current_user,
    get_optional_user,
)
from app.config import settings


# ── Password helpers ──────────────────────────────────────────────────────

class TestPasswordHashing:
    def test_hash_is_not_plain_text(self):
        hashed = hash_password("secret")
        assert hashed != "secret"

    def test_verify_correct_password(self):
        hashed = hash_password("correct")
        assert verify_password("correct", hashed) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("correct")
        assert verify_password("wrong", hashed) is False

    def test_same_password_produces_different_hashes(self):
        """bcrypt uses a random salt — hashes should never be identical."""
        h1 = hash_password("password")
        h2 = hash_password("password")
        assert h1 != h2

    def test_hash_is_bcrypt_format(self):
        hashed = hash_password("any")
        assert hashed.startswith("$2b$") or hashed.startswith("$2a$")


# ── JWT helpers ───────────────────────────────────────────────────────────

class TestJWT:
    def test_create_token_returns_string(self):
        token = create_access_token("abc123", "user@test.com")
        assert isinstance(token, str)
        assert len(token) > 20

    def test_decode_valid_token(self):
        token = create_access_token("abc123", "user@test.com")
        payload = decode_token(token)
        assert payload["sub"] == "abc123"
        assert payload["email"] == "user@test.com"

    def test_decode_tampered_token_raises_401(self):
        token = create_access_token("abc123", "user@test.com")
        bad_token = token[:-4] + "xxxx"
        with pytest.raises(HTTPException) as exc_info:
            decode_token(bad_token)
        assert exc_info.value.status_code == 401

    def test_decode_garbage_raises_401(self):
        with pytest.raises(HTTPException) as exc_info:
            decode_token("not.a.token")
        assert exc_info.value.status_code == 401

    def test_expired_token_raises_401(self):
        """Manually create a token with past expiry."""
        from datetime import datetime
        payload = {
            "sub": "abc123",
            "email": "user@test.com",
            "exp": datetime(2000, 1, 1),  # already expired
        }
        expired_token = jwt.encode(
            payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM
        )
        with pytest.raises(HTTPException) as exc_info:
            decode_token(expired_token)
        assert exc_info.value.status_code == 401

    def test_token_signed_with_wrong_secret_raises_401(self):
        payload = {"sub": "abc", "email": "x@x.com", "exp": 9999999999}
        bad_token = jwt.encode(payload, "wrong-secret", algorithm="HS256")
        with pytest.raises(HTTPException) as exc_info:
            decode_token(bad_token)
        assert exc_info.value.status_code == 401


# ── FastAPI dependencies ──────────────────────────────────────────────────

class TestGetCurrentUser:
    def test_no_credentials_raises_401(self):
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(get_current_user(creds=None))
        assert exc_info.value.status_code == 401

    def test_user_not_in_db_raises_401(self, mock_db):
        token = create_access_token(str(ObjectId()), "nobody@test.com")
        creds = MagicMock()
        creds.credentials = token

        mock_db.users.find_one = AsyncMock(return_value=None)

        with patch("app.services.auth.get_db", return_value=mock_db):
            with pytest.raises(HTTPException) as exc_info:
                asyncio.run(get_current_user(creds=creds))
        assert exc_info.value.status_code == 401

    def test_valid_token_returns_user(self, mock_db, test_user, user_id):
        token = create_access_token(user_id, "test@example.com")
        creds = MagicMock()
        creds.credentials = token

        mock_db.users.find_one = AsyncMock(return_value=test_user)

        with patch("app.services.auth.get_db", return_value=mock_db):
            result = asyncio.run(get_current_user(creds=creds))
        assert result["email"] == "test@example.com"


class TestGetOptionalUser:
    def test_no_credentials_returns_none(self):
        result = asyncio.run(get_optional_user(creds=None))
        assert result is None

    def test_invalid_token_returns_none(self):
        creds = MagicMock()
        creds.credentials = "bad.token.here"
        result = asyncio.run(get_optional_user(creds=creds))
        assert result is None

    def test_valid_token_returns_user(self, mock_db, test_user, user_id):
        token = create_access_token(user_id, "test@example.com")
        creds = MagicMock()
        creds.credentials = token

        mock_db.users.find_one = AsyncMock(return_value=test_user)

        with patch("app.services.auth.get_db", return_value=mock_db):
            result = asyncio.run(get_optional_user(creds=creds))
        assert result is not None
        assert result["name"] == "Test User"
