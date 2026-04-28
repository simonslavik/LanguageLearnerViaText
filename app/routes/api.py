"""Translation API routes — FastAPI endpoints for the React frontend."""

import asyncio
import hashlib
import logging
import os
import tempfile
import uuid
from datetime import datetime

import genanki
from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse as FastAPIFileResponse
from langdetect import detect as detect_language
from pydantic import BaseModel
from typing import List, Optional

from app.config import settings
from app.constants import MAX_WORD_LENGTH
from app.database import get_db
from app.limiter import limiter
from app.services.auth import get_optional_user
from app.services.pdf_parser import extract_text_from_pdf
from app.services.translator import (
    SUPPORTED_LANGUAGES,
    build_freq_tiers,
    build_sentence_alignment,
    build_word_map,
    compute_cefr,
    translate_text,
)
from app.utils.helpers import allowed_file

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["translation"])


@router.get("/languages")
async def get_languages():
    """Return the list of supported target languages."""
    return SUPPORTED_LANGUAGES


@router.post("/translate")
@limiter.limit("10/minute")
async def translate(
    request: Request,
    pdf_file: UploadFile = File(...),
    target_lang: str = Form(...),
    user=Depends(get_optional_user),
):
    """Accept a PDF upload + target language and return original & translated text."""

    # --- validate file name ---
    if not pdf_file.filename:
        raise HTTPException(status_code=400, detail="No file selected.")

    if not allowed_file(pdf_file.filename):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    # --- validate language ---
    if target_lang not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail="Please select a valid target language.")

    # --- read & enforce size limit ---
    contents = await pdf_file.read()
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds the {settings.MAX_UPLOAD_MB} MB size limit.",
        )

    # --- save to disk ---
    unique_name = f"{uuid.uuid4().hex}_{pdf_file.filename}"
    upload_path = os.path.join(settings.UPLOAD_FOLDER, unique_name)

    try:
        with open(upload_path, "wb") as f:
            f.write(contents)

        original_text = extract_text_from_pdf(upload_path)

        # Detect source language (fallback to "en")
        try:
            source_lang_code = detect_language(original_text[:500])
        except Exception:
            source_lang_code = "en"

        # Parallelise the two expensive translation calls
        sentence_pairs, word_map = await asyncio.gather(
            asyncio.to_thread(build_sentence_alignment, original_text, target_lang),
            asyncio.to_thread(build_word_map, original_text, target_lang),
        )

        translated_text = " ".join(p["translated"] for p in sentence_pairs if p["translated"])

        word_freq_tiers = build_freq_tiers(original_text, source_lang_code)
        translated_word_freq_tiers = build_freq_tiers(translated_text, target_lang)
        original_cefr = compute_cefr(original_text, source_lang_code)
        translated_cefr = compute_cefr(translated_text, target_lang)

        result = {
            "filename": pdf_file.filename,
            "target_lang": SUPPORTED_LANGUAGES[target_lang],
            "target_lang_code": target_lang,
            "source_lang_code": source_lang_code,
            "original_text": original_text,
            "translated_text": translated_text,
            "word_map": word_map,
            "word_freq_tiers": word_freq_tiers,
            "translated_word_freq_tiers": translated_word_freq_tiers,
            "original_cefr": original_cefr,
            "translated_cefr": translated_cefr,
            "sentence_pairs": sentence_pairs,
        }

        # Save to history if the user is logged in
        if user:
            db = get_db()
            history_doc = {
                **result,
                "user_id": ObjectId(user["_id"]),
                "created_at": datetime.utcnow().isoformat(),
            }
            insert_result = await db.history.insert_one(history_doc)
            result["history_id"] = str(insert_result.inserted_id)

        return result

    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    except HTTPException:
        raise

    except Exception as exc:
        logger.error("Translation processing failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Translation processing failed.")

    finally:
        try:
            if os.path.exists(upload_path):
                os.remove(upload_path)
        except OSError as exc:
            logger.warning("Failed to clean up upload file %s: %s", upload_path, exc)


@router.post("/translate-word")
async def translate_word(
    word: str = Form(...),
    target_lang: str = Form(...),
    source_lang: str = Form("auto"),
):
    """Translate a single word or short phrase to the target language."""

    if target_lang not in SUPPORTED_LANGUAGES and target_lang != "auto":
        raise HTTPException(status_code=400, detail="Please select a valid target language.")

    word = word.strip()
    if not word:
        raise HTTPException(status_code=400, detail="No word provided.")

    if len(word) > MAX_WORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Word exceeds maximum length of {MAX_WORD_LENGTH} characters.",
        )

    try:
        translated = translate_text(word, target_lang, source_lang)
        return {
            "word": word,
            "translated": translated.strip(),
            "target_lang": SUPPORTED_LANGUAGES.get(target_lang, target_lang),
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Word translation failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Word translation failed.")


# ── Anki Export ──────────────────────────────────────────────────────────

class VocabEntry(BaseModel):
    word: str
    translated: str
    targetLang: Optional[str] = ""
    added: Optional[int] = 0


class AnkiExportRequest(BaseModel):
    vocab: List[VocabEntry]
    deck_name: Optional[str] = "PDF Translator Vocabulary"


@router.post("/export-anki")
async def export_anki(payload: AnkiExportRequest):
    """Generate an Anki .apkg deck from the user's vocabulary list."""
    if not payload.vocab:
        raise HTTPException(status_code=400, detail="No vocabulary to export.")

    # Deterministic model & deck IDs derived from deck name (stable across exports)
    seed = int(hashlib.sha256(payload.deck_name.encode()).hexdigest()[:8], 16)
    model_id = 1607392319 + (seed % 100000)
    deck_id = 2059400110 + (seed % 100000)

    model = genanki.Model(
        model_id,
        "PDF Translator Card",
        fields=[
            {"name": "Front"},
            {"name": "Back"},
            {"name": "Language"},
        ],
        templates=[
            {
                "name": "Card 1",
                "qfmt": (
                    '<div style="font-family: system-ui, sans-serif; text-align: center;">'
                    '<div style="font-size: 28px; font-weight: 700; margin-bottom: 12px;">{{Front}}</div>'
                    '<div style="font-size: 13px; color: #888;">{{Language}}</div>'
                    "</div>"
                ),
                "afmt": (
                    '<div style="font-family: system-ui, sans-serif; text-align: center;">'
                    '<div style="font-size: 28px; font-weight: 700; margin-bottom: 12px;">{{Front}}</div>'
                    "<hr id=answer>"
                    '<div style="font-size: 26px; color: #2563eb; font-weight: 600;">{{Back}}</div>'
                    '<div style="font-size: 13px; color: #888; margin-top: 8px;">{{Language}}</div>'
                    "</div>"
                ),
            },
        ],
        css=(
            ".card { font-family: system-ui, -apple-system, sans-serif; "
            "background: #fff; padding: 20px; }"
        ),
    )

    deck = genanki.Deck(deck_id, payload.deck_name)

    for entry in payload.vocab:
        note = genanki.Note(
            model=model,
            fields=[entry.word, entry.translated, entry.targetLang or ""],
        )
        deck.add_note(note)

    tmp = tempfile.NamedTemporaryFile(suffix=".apkg", delete=False)
    try:
        genanki.Package(deck).write_to_file(tmp.name)
        return FastAPIFileResponse(
            path=tmp.name,
            filename=f"{payload.deck_name}.apkg",
            media_type="application/octet-stream",
            background=None,
        )
    except Exception as exc:
        if os.path.exists(tmp.name):
            os.remove(tmp.name)
        logger.error("Anki export failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Anki export failed.")
