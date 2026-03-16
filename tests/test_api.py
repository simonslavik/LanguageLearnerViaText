"""Tests for the FastAPI translation endpoints."""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_get_languages():
    """GET /api/languages returns all supported languages."""
    resp = client.get("/api/languages")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)
    assert "en" in data
    assert "es" in data
    assert len(data) == 20


def test_translate_no_file():
    """POST /api/translate without a file returns 422 (FastAPI validation)."""
    resp = client.post("/api/translate", data={"target_lang": "es"})
    assert resp.status_code == 422


def test_translate_invalid_extension():
    """POST /api/translate with a non-PDF file returns 400."""
    resp = client.post(
        "/api/translate",
        data={"target_lang": "es"},
        files={"pdf_file": ("test.txt", b"hello", "text/plain")},
    )
    assert resp.status_code == 400
    assert "PDF" in resp.json()["detail"]


def test_translate_invalid_language():
    """POST /api/translate with an unsupported language returns 400."""
    resp = client.post(
        "/api/translate",
        data={"target_lang": "xx_FAKE"},
        files={"pdf_file": ("test.pdf", b"%PDF-1.4 dummy", "application/pdf")},
    )
    assert resp.status_code == 400
    assert "language" in resp.json()["detail"].lower()


@patch("app.routes.api.build_sentence_alignment")
@patch("app.routes.api.build_word_map")
@patch("app.routes.api.translate_text")
@patch("app.routes.api.extract_text_from_pdf")
def test_translate_success(mock_extract, mock_translate, mock_word_map, mock_sent_align):
    """POST /api/translate with valid inputs returns original + translated text."""
    mock_extract.return_value = "Hello world"
    mock_translate.return_value = "Hola mundo"
    mock_word_map.return_value = {"hello": "hola", "world": "mundo"}
    mock_sent_align.return_value = [{"original": "Hello world", "translated": "Hola mundo"}]

    resp = client.post(
        "/api/translate",
        data={"target_lang": "es"},
        files={"pdf_file": ("doc.pdf", b"%PDF-1.4 dummy", "application/pdf")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["original_text"] == "Hello world"
    assert data["translated_text"] == "Hola mundo"
    assert data["filename"] == "doc.pdf"
    assert data["target_lang"] == "Spanish"
