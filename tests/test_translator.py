"""Tests for the translator service."""

import pytest
from unittest.mock import patch, MagicMock

from app.services.translator import (
    translate_text,
    _chunk_text,
    _split_sentences,
    build_sentence_alignment,
    SUPPORTED_LANGUAGES,
)


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


# ── Sentence splitting ────────────────────────────────────────────────

def test_split_sentences_basic():
    """Basic sentence splitting on punctuation."""
    text = "Hello world. How are you? I am fine!"
    sents = _split_sentences(text)
    assert len(sents) == 3
    assert sents[0] == "Hello world."
    assert sents[1] == "How are you?"
    assert sents[2] == "I am fine!"


def test_split_sentences_pdf_newlines():
    """Single newlines (PDF line-wraps) should NOT create new sentences."""
    text = "This is a long sentence that\nwraps to the next line. And here is another."
    sents = _split_sentences(text)
    assert len(sents) == 2
    assert "wraps to the next line." in sents[0]


def test_split_sentences_paragraph_break():
    """Double newlines (paragraph breaks) SHOULD split sentences."""
    text = "First paragraph.\n\nSecond paragraph."
    sents = _split_sentences(text)
    assert len(sents) == 2


def test_split_sentences_abbreviations():
    """Abbreviations like Dr., Mr. should not split sentences."""
    text = "Dr. Smith went to the store. He bought milk."
    sents = _split_sentences(text)
    assert len(sents) == 2
    assert "Dr. Smith" in sents[0]


def test_split_sentences_initials():
    """Single-letter initials (J. K. Rowling) should not split."""
    text = "J. K. Rowling wrote Harry Potter. It was popular."
    sents = _split_sentences(text)
    assert len(sents) == 2
    assert "J. K. Rowling" in sents[0]


# ── Sentence alignment ───────────────────────────────────────────────

def test_alignment_equal_counts():
    """When sentence counts match, pairs should be 1:1."""
    pairs = build_sentence_alignment(
        "Hello. World.", "Hola. Mundo."
    )
    assert len(pairs) == 2
    assert pairs[0]["original"] == "Hello."
    assert pairs[0]["translated"] == "Hola."


def test_alignment_mismatched_counts():
    """When counts differ, proportional merging should produce
    the same number of pairs as the longer list."""
    orig = "One. Two. Three."
    trans = "Uno dos. Tres."
    pairs = build_sentence_alignment(orig, trans)
    # 3 orig vs 2 trans → 3 pairs (longer wins), translated merged
    assert len(pairs) == 3
    # Every pair should have non-empty original
    assert all(p["original"] for p in pairs)
