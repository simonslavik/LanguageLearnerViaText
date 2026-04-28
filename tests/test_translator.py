"""Tests for the translator service."""

import pytest
from unittest.mock import patch, MagicMock, call

from app.services.translator import (
    translate_text,
    _chunk_text,
    _split_sentences,
    build_sentence_alignment,
    build_word_map,
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


def test_split_sentences_empty():
    assert _split_sentences("") == []
    assert _split_sentences("   ") == []


def test_split_sentences_no_punctuation():
    """A paragraph with no sentence-ending punct should come back as one sentence."""
    text = "This has no terminal punctuation"
    sents = _split_sentences(text)
    assert len(sents) == 1
    assert sents[0] == "This has no terminal punctuation"


def test_split_sentences_abbreviations_not_split():
    """Common abbreviations like Dr. and Mr. must not trigger a new sentence."""
    text = "Dr. Smith and Mr. Jones attended. They left at 9 p.m. sharp."
    sents = _split_sentences(text)
    # Should not produce fragments like ["Dr.", "Smith and Mr.", ...]
    assert all(len(s) > 5 for s in sents)


def test_split_sentences_paragraph_breaks():
    """Double-newline paragraphs should each be processed independently."""
    text = "First paragraph.\n\nSecond paragraph."
    sents = _split_sentences(text)
    assert len(sents) == 2


# ── build_sentence_alignment ──────────────────────────────────────────────

@patch("app.services.translator.GoogleTranslator")
def test_build_sentence_alignment_returns_pairs(mock_gt_cls):
    """Alignment produces one dict per sentence with 'original'/'translated' keys."""
    mock_instance = MagicMock()
    mock_instance.translate.side_effect = lambda t: f"[T]{t}"
    mock_gt_cls.return_value = mock_instance

    pairs = build_sentence_alignment("Hello world. How are you?", "es")
    assert isinstance(pairs, list)
    assert len(pairs) >= 1
    for pair in pairs:
        assert "original" in pair
        assert "translated" in pair


@patch("app.services.translator.GoogleTranslator")
def test_build_sentence_alignment_empty_text(mock_gt_cls):
    """Empty input returns an empty list without calling the API."""
    pairs = build_sentence_alignment("", "es")
    assert pairs == []
    mock_gt_cls.assert_not_called()


# ── build_word_map ────────────────────────────────────────────────────────

@patch("app.services.translator.GoogleTranslator")
def test_build_word_map_basic(mock_gt_cls):
    """build_word_map returns a dict mapping source words to translations."""
    mock_instance = MagicMock()
    # Simulate batch response: one translated line per word
    mock_instance.translate.side_effect = lambda t: "\n".join(
        f"[T]{w}" for w in t.split("\n")
    )
    mock_gt_cls.return_value = mock_instance

    result = build_word_map("Hello world", "es")
    assert isinstance(result, dict)


@patch("app.services.translator.GoogleTranslator")
def test_build_word_map_empty_text_returns_empty(mock_gt_cls):
    result = build_word_map("", "es")
    assert result == {}
    mock_gt_cls.assert_not_called()


def test_build_word_map_unsupported_lang_returns_empty():
    """build_word_map returns {} (no raise) for unsupported languages."""
    result = build_word_map("Hello", "xx_FAKE")
    assert result == {}


# ── SUPPORTED_LANGUAGES ───────────────────────────────────────────────────

def test_supported_languages_count():
    assert len(SUPPORTED_LANGUAGES) == 20


def test_supported_languages_contains_major_codes():
    for code in ("en", "es", "fr", "de", "zh-CN", "ja", "ar"):
        assert code in SUPPORTED_LANGUAGES


def test_supported_languages_values_are_nonempty_strings():
    for code, name in SUPPORTED_LANGUAGES.items():
        assert isinstance(name, str) and len(name) > 0


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

@patch("app.services.translator.GoogleTranslator")
def test_alignment_equal_counts(mock_gt_cls):
    """When sentence counts match, pairs should be 1:1."""
    mock_instance = MagicMock()
    # Simulate: "Hello." → "Hola.", "World." → "Mundo." (one sentence per call)
    mock_instance.translate.side_effect = lambda t: {"Hello.": "Hola.", "World.": "Mundo."}.get(t.strip(), f"[T]{t}")
    mock_gt_cls.return_value = mock_instance

    pairs = build_sentence_alignment("Hello. World.", "es")
    assert len(pairs) == 2
    assert pairs[0]["original"] == "Hello."
    assert pairs[1]["original"] == "World."


@patch("app.services.translator.GoogleTranslator")
def test_alignment_mismatched_counts(mock_gt_cls):
    """When counts differ, proportional merging should produce
    the same number of pairs as the longer list."""
    mock_instance = MagicMock()
    mock_instance.translate.side_effect = lambda t: f"[T]{t}"
    mock_gt_cls.return_value = mock_instance

    orig = "One. Two. Three."
    pairs = build_sentence_alignment(orig, "es")
    # Every pair should have non-empty original
    assert all(p["original"] for p in pairs)
