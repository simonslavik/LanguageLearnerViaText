"""Integration tests for word translation and Anki export endpoints.

  POST /api/translate-word  — single-word lookup
  POST /api/export-anki     — Anki .apkg deck generation
"""

import pytest
from unittest.mock import patch, MagicMock


# ── POST /api/translate-word ──────────────────────────────────────────────

class TestTranslateWord:
    @patch("app.routes.api.translate_text", return_value="Hola")
    def test_translate_word_success(self, mock_translate, client):
        resp = client.post(
            "/api/translate-word",
            data={"word": "Hello", "target_lang": "es", "source_lang": "en"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["word"] == "Hello"
        assert data["translated"] == "Hola"
        assert data["target_lang"] == "Spanish"

    @patch("app.routes.api.translate_text", return_value="Bonjour")
    def test_translate_word_default_source_lang(self, mock_translate, client):
        """source_lang defaults to 'auto' when not supplied."""
        resp = client.post(
            "/api/translate-word",
            data={"word": "Hello", "target_lang": "fr"},
        )
        assert resp.status_code == 200
        assert resp.json()["translated"] == "Bonjour"

    def test_translate_word_invalid_language(self, client):
        resp = client.post(
            "/api/translate-word",
            data={"word": "Hello", "target_lang": "xx_FAKE"},
        )
        assert resp.status_code == 400
        assert "language" in resp.json()["detail"].lower()

    def test_translate_word_empty_word(self, client):
        resp = client.post(
            "/api/translate-word",
            data={"word": "   ", "target_lang": "es"},
        )
        assert resp.status_code == 400
        assert "word" in resp.json()["detail"].lower()

    def test_translate_word_missing_word_field(self, client):
        resp = client.post(
            "/api/translate-word",
            data={"target_lang": "es"},
        )
        assert resp.status_code == 422

    def test_translate_word_missing_target_lang(self, client):
        resp = client.post(
            "/api/translate-word",
            data={"word": "Hello"},
        )
        assert resp.status_code == 422

    @patch("app.routes.api.translate_text", side_effect=Exception("API down"))
    def test_translate_word_upstream_error_returns_500(self, mock_translate, client):
        resp = client.post(
            "/api/translate-word",
            data={"word": "Hello", "target_lang": "es"},
        )
        assert resp.status_code == 500


# ── POST /api/export-anki ─────────────────────────────────────────────────

class TestExportAnki:
    _VOCAB = [
        {"word": "apple", "translated": "manzana", "targetLang": "es"},
        {"word": "book", "translated": "libro", "targetLang": "es"},
    ]

    def test_export_returns_apkg_file(self, client):
        resp = client.post(
            "/api/export-anki",
            json={"vocab": self._VOCAB, "deck_name": "Test Deck"},
        )
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/octet-stream"
        # Anki .apkg files are ZIP archives — check the magic bytes
        assert resp.content[:2] == b"PK"

    def test_export_default_deck_name(self, client):
        """Omitting deck_name should still succeed."""
        resp = client.post(
            "/api/export-anki",
            json={"vocab": self._VOCAB},
        )
        assert resp.status_code == 200

    def test_export_single_word(self, client):
        resp = client.post(
            "/api/export-anki",
            json={"vocab": [{"word": "cat", "translated": "gato", "targetLang": "es"}]},
        )
        assert resp.status_code == 200

    def test_export_empty_vocab_returns_400(self, client):
        resp = client.post(
            "/api/export-anki",
            json={"vocab": []},
        )
        assert resp.status_code == 400
        assert "vocabulary" in resp.json()["detail"].lower()

    def test_export_missing_vocab_returns_422(self, client):
        resp = client.post("/api/export-anki", json={})
        assert resp.status_code == 422

    def test_export_deterministic_for_same_deck_name(self, client):
        """Two exports with identical inputs produce the same file size."""
        payload = {"vocab": self._VOCAB, "deck_name": "Stable Deck"}
        r1 = client.post("/api/export-anki", json=payload)
        r2 = client.post("/api/export-anki", json=payload)
        assert r1.status_code == 200
        assert len(r1.content) == len(r2.content)
