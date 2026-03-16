"""Tests for the translator service."""

import pytest
from unittest.mock import patch, MagicMock

from app.services.translator import translate_text, _chunk_text, SUPPORTED_LANGUAGES


def test_chunk_text_short():
    """Short text should return a single chunk."""
    chunks = _chunk_text("Hello world", max_len=100)
    assert len(chunks) == 1
    assert chunks[0] == "Hello world"


def test_chunk_text_splits_on_newline():
    """Long text should split on newlines when possible."""
    text = "Line one\nLine two\nLine three"
    chunks = _chunk_text(text, max_len=18)
    assert len(chunks) >= 2


def test_unsupported_language():
    """Raise ValueError for an unsupported language code."""
    with pytest.raises(ValueError, match="Unsupported"):
        translate_text("Hello", "xx_FAKE")


@patch("app.services.translator.GoogleTranslator")
def test_translate_text_success(mock_gt_cls):
    """translate_text returns the translated string."""
    mock_instance = MagicMock()
    mock_instance.translate.return_value = "Hola mundo"
    mock_gt_cls.return_value = mock_instance

    result = translate_text("Hello world", "es")
    assert result == "Hola mundo"
    mock_gt_cls.assert_called_once_with(source="auto", target="es")


@patch("app.services.translator.GoogleTranslator")
def test_translate_text_chunks(mock_gt_cls):
    """Large text should be chunked and each chunk translated."""
    mock_instance = MagicMock()
    mock_instance.translate.side_effect = lambda t: f"[translated]{t}"
    mock_gt_cls.return_value = mock_instance

    long_text = "word " * 2000  # ~10 000 chars → multiple chunks
    result = translate_text(long_text, "fr")

    assert mock_instance.translate.call_count >= 2
    assert "[translated]" in result
