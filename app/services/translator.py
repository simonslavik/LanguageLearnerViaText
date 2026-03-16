"""Translation service — translates text to a target language using Google Translate."""

import re

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


def build_word_map(text: str, target_lang: str, source_lang: str = "auto") -> dict:
    """Build a word-level translation dictionary from the source text.

    Extracts every unique word, batch-translates them, and returns a mapping
    ``{original_lower: translated_lower}``.
    """
    if target_lang not in SUPPORTED_LANGUAGES:
        return {}

    raw_words = re.findall(r"[\w']+", text, re.UNICODE)

    seen: set[str] = set()
    unique_words: list[str] = []
    for w in raw_words:
        lower = w.lower()
        if lower not in seen and len(lower) > 1:
            seen.add(lower)
            unique_words.append(lower)

    if not unique_words:
        return {}

    # Build batches respecting the Google Translate char limit
    batches: list[list[str]] = []
    current_batch: list[str] = []
    current_len = 0

    for word in unique_words:
        addition = len(word) + (1 if current_batch else 0)
        if current_len + addition > _CHUNK_SIZE:
            batches.append(current_batch)
            current_batch = [word]
            current_len = len(word)
        else:
            current_batch.append(word)
            current_len += addition

    if current_batch:
        batches.append(current_batch)

    word_map: dict[str, str] = {}

    for batch in batches:
        batch_text = "\n".join(batch)
        try:
            translator = GoogleTranslator(source=source_lang, target=target_lang)
            translated_batch = translator.translate(batch_text)
            if not translated_batch:
                continue
            translated_words = translated_batch.split("\n")
            for orig, trans in zip(batch, translated_words):
                trans_clean = trans.strip().lower()
                if trans_clean:
                    word_map[orig] = trans_clean
        except Exception:
            continue

    return word_map
