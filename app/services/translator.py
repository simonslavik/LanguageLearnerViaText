"""Translation service — translates text to a target language using Google Translate."""

import re
from typing import Tuple

from deep_translator import GoogleTranslator

# Supported languages (code → display name)
SUPPORTED_LANGUAGES: dict[str, str] = {
    "en": "English",
    "cs": "Czech",
    "de": "German",
    "es": "Spanish",
    "fr": "French",
    "it": "Italian",
    "ja": "Japanese",
    "ko": "Korean",
    "nl": "Dutch",
    "pl": "Polish",
    "pt": "Portuguese",
    "ru": "Russian",
    "sk": "Slovak",
    "uk": "Ukrainian",
    "zh-CN": "Chinese (Simplified)",
    "ar": "Arabic",
    "hi": "Hindi",
    "tr": "Turkish",
    "sv": "Swedish",
    "da": "Danish",
}

# Google Translate has a 5 000-char limit per request
_CHUNK_SIZE = 4900


def _chunk_text(text: str, max_len: int = _CHUNK_SIZE) -> list[str]:
    """Split text into chunks that fit within the translation API limit."""
    chunks: list[str] = []
    while text:
        if len(text) <= max_len:
            chunks.append(text)
            break
        # Try to split on the last newline within the limit
        split_idx = text.rfind("\n", 0, max_len)
        if split_idx == -1:
            # Fall back to the last space
            split_idx = text.rfind(" ", 0, max_len)
        if split_idx == -1:
            split_idx = max_len
        chunks.append(text[:split_idx])
        text = text[split_idx:].lstrip("\n")
    return chunks


def translate_text(text: str, target_lang: str, source_lang: str = "auto") -> str:
    """Translate *text* into *target_lang*.

    Args:
        text: The source text to translate.
        target_lang: ISO language code for the target language.
        source_lang: ISO language code for the source language (default: auto-detect).

    Returns:
        The translated text.
    """
    if target_lang not in SUPPORTED_LANGUAGES:
        raise ValueError(f"Unsupported target language: {target_lang}")

    chunks = _chunk_text(text)
    translated_chunks: list[str] = []

    for chunk in chunks:
        translator = GoogleTranslator(source=source_lang, target=target_lang)
        result = translator.translate(chunk)
        if result:
            translated_chunks.append(result)

    return "\n".join(translated_chunks)


# ---------------------------------------------------------------------------
# Word-level mapping
# ---------------------------------------------------------------------------

# Max words per batch — smaller batches = more reliable alignment
_WORD_BATCH_SIZE = 25


def build_word_map(text: str, target_lang: str, source_lang: str = "auto") -> dict:
    """Build a word-level translation dictionary from the source text.

    Extracts every unique word (≥2 chars), batch-translates them in small
    groups (one word per line), and returns ``{original_lower: translated_lower}``.
    Falls back to individual translation when a batch produces misaligned output.
    """
    if target_lang not in SUPPORTED_LANGUAGES:
        return {}

    # Extract words — letters/digits/apostrophes, skip pure numbers
    raw_words = re.findall(r"[^\W\d_][\w']*", text, re.UNICODE)

    seen: set[str] = set()
    unique_words: list[str] = []
    for w in raw_words:
        lower = w.lower()
        if lower not in seen and len(lower) > 1:
            seen.add(lower)
            unique_words.append(lower)

    if not unique_words:
        return {}

    word_map: dict[str, str] = {}

    def _translate_single(word: str) -> str | None:
        """Translate one word individually (fallback)."""
        try:
            t = GoogleTranslator(source=source_lang, target=target_lang)
            result = t.translate(word)
            if result:
                return result.strip().lower()
        except Exception:
            pass
        return None

    # Process in small fixed-size batches
    for i in range(0, len(unique_words), _WORD_BATCH_SIZE):
        batch = unique_words[i : i + _WORD_BATCH_SIZE]
        batch_text = "\n".join(batch)

        try:
            translator = GoogleTranslator(source=source_lang, target=target_lang)
            translated_batch = translator.translate(batch_text)
            if not translated_batch:
                # Batch failed — try individually
                for word in batch:
                    trans = _translate_single(word)
                    if trans and trans != word:
                        word_map[word] = trans
                continue

            translated_lines = translated_batch.split("\n")

            # ── Validate line count ──
            if len(translated_lines) == len(batch):
                for orig, trans in zip(batch, translated_lines):
                    trans_clean = trans.strip().lower()
                    if trans_clean and trans_clean != orig:
                        word_map[orig] = trans_clean
            else:
                # Misaligned — translate each word individually
                for word in batch:
                    trans = _translate_single(word)
                    if trans and trans != word:
                        word_map[word] = trans

        except Exception:
            # Batch error — translate individually
            for word in batch:
                trans = _translate_single(word)
                if trans and trans != word:
                    word_map[word] = trans

    return word_map


# ---------------------------------------------------------------------------
# Sentence splitting & alignment
# ---------------------------------------------------------------------------

# Common abbreviations that end with '.' but are NOT sentence boundaries
_ABBREVIATIONS = frozenset({
    "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "vs", "etc", "inc",
    "ltd", "st", "ave", "dept", "est", "vol", "no", "fig", "approx",
    "cf", "al", "ed", "trans", "rev", "gen", "gov", "sgt", "cpl",
    "pvt", "capt", "col", "maj", "lt", "cmdr", "adm", "corp", "co",
    "e.g", "i.e", "p", "pp", "ch", "sec",
})

# Sentence-ending punctuation followed by whitespace
_SENT_SPLIT_RE = re.compile(r"(?<=[.!?…])\s+", re.UNICODE)


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences with robust handling of PDF line-wraps,
    abbreviations, and paragraph boundaries.

    Key improvements over naive splitting:
    - Single newlines (PDF line-wraps) are replaced with spaces.
    - Paragraph breaks (double-newlines) are respected.
    - Abbreviations (Dr., Mr., etc.) don't create false sentence boundaries.
    - Single-letter initials (A. B. Smith) don't split sentences.
    """
    if not text or not text.strip():
        return []

    # 1. Normalise paragraph breaks
    text = re.sub(r"\n\s*\n", "\n\n", text)

    # 2. Split into paragraphs on double-newlines
    paragraphs = text.split("\n\n")

    sentences: list[str] = []

    for para in paragraphs:
        # Replace single newlines (PDF line-wraps) with spaces
        para = re.sub(r"\s*\n\s*", " ", para).strip()
        if not para:
            continue

        # Split on sentence-ending punctuation followed by whitespace
        raw_parts = _SENT_SPLIT_RE.split(para)

        for part in raw_parts:
            part = part.strip()
            if not part:
                continue

            # Try to merge with previous sentence if it ended with an abbreviation
            if sentences:
                last = sentences[-1]
                last_words = last.split()
                if last_words:
                    last_token = last_words[-1].rstrip(".")
                    # Known abbreviation?
                    if last_token.lower() in _ABBREVIATIONS:
                        sentences[-1] = last + " " + part
                        continue
                    # Single-letter initial (e.g. "J." or "A.")?
                    if re.search(r"\b[A-Za-z]\.$", last):
                        sentences[-1] = last + " " + part
                        continue
                    # Number followed by period (e.g. "3." in a list)?
                    if re.search(r"\b\d+\.$", last):
                        sentences[-1] = last + " " + part
                        continue

            sentences.append(part)

    return sentences


def build_sentence_alignment(
    original_text: str,
    translated_text: str,
) -> list[dict]:
    """Return a list of ``{"original": ..., "translated": ...}`` pairs.

    Sentences are split heuristically.  When the counts differ the shorter
    text's sentences are **proportionally merged** so that every original
    sentence maps to at least one translated sentence (or vice-versa).
    """
    orig_sents = _split_sentences(original_text)
    trans_sents = _split_sentences(translated_text)

    if not orig_sents:
        orig_sents = [original_text.strip()] if original_text.strip() else []
    if not trans_sents:
        trans_sents = [translated_text.strip()] if translated_text.strip() else []

    if not orig_sents and not trans_sents:
        return []

    # Perfect match — pair 1:1
    if len(orig_sents) == len(trans_sents):
        return [
            {"original": o, "translated": t}
            for o, t in zip(orig_sents, trans_sents)
        ]

    # Mismatch — proportional alignment: keep the longer list intact,
    # merge segments from the shorter list so every entry has a partner.
    pairs: list[dict] = []
    o_len = len(orig_sents)
    t_len = len(trans_sents)

    if o_len >= t_len:
        # More original sentences — merge translated segments proportionally
        for i in range(o_len):
            t_start = round(i * t_len / o_len)
            t_end = round((i + 1) * t_len / o_len)
            merged_t = " ".join(trans_sents[t_start:t_end])
            pairs.append({"original": orig_sents[i], "translated": merged_t})
    else:
        # More translated sentences — merge original segments proportionally
        for i in range(t_len):
            o_start = round(i * o_len / t_len)
            o_end = round((i + 1) * o_len / t_len)
            merged_o = " ".join(orig_sents[o_start:o_end])
            pairs.append({"original": merged_o, "translated": trans_sents[i]})

    return pairs
