"""Translation API routes — FastAPI endpoints for the React frontend."""

import os
import uuid
from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.config import settings
from app.database import get_db
from app.services.auth import get_optional_user
from app.services.pdf_parser import extract_text_from_pdf
from langdetect import detect as detect_language
from wordfreq import zipf_frequency

from app.services.translator import (
    SUPPORTED_LANGUAGES,
    build_sentence_alignment,
    build_word_map,
    translate_text,
)
from app.utils.helpers import allowed_file

router = APIRouter(prefix="/api", tags=["translation"])


@router.get("/languages")
async def get_languages():
    """Return the list of supported target languages."""
    return SUPPORTED_LANGUAGES


@router.post("/translate")
async def translate(
    pdf_file: UploadFile = File(...),
    target_lang: str = Form(...),
    user=Depends(get_optional_user),
):
    """Accept a PDF upload + target language and return original & translated text."""

    # --- validate file ---
    if not pdf_file.filename:
        raise HTTPException(status_code=400, detail="No file selected.")

    if not allowed_file(pdf_file.filename):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    # --- validate language ---
    if target_lang not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail="Please select a valid target language.")

    # --- save uploaded file ---
    unique_name = f"{uuid.uuid4().hex}_{pdf_file.filename}"
    upload_path = os.path.join(settings.UPLOAD_FOLDER, unique_name)

    try:
        contents = await pdf_file.read()
        with open(upload_path, "wb") as f:
            f.write(contents)

        original_text = extract_text_from_pdf(upload_path)

        # Detect the source language so the frontend can do reverse translation
        try:
            source_lang_code = detect_language(original_text[:500])
        except Exception:
            source_lang_code = "en"  # fallback

        sentence_pairs = build_sentence_alignment(original_text, target_lang)
        translated_text = " ".join(p["translated"] for p in sentence_pairs if p["translated"])
        word_map = build_word_map(original_text, target_lang)

        # Build word frequency tiers using real language frequency data
        import re as _re

        def _build_freq_tiers(text, lang_code):
            unique_words = set()
            for w in _re.findall(r'[\w]+', text.lower()):
                if len(w) >= 2:
                    unique_words.add(w)
            tiers = {}
            for w in unique_words:
                z = zipf_frequency(w, lang_code)
                if z >= 5.5:
                    tiers[w] = 'freq-very-common'
                elif z >= 4.0:
                    tiers[w] = 'freq-common'
                elif z >= 2.5:
                    tiers[w] = 'freq-uncommon'
                else:
                    tiers[w] = 'freq-rare'
            return tiers

        word_freq_tiers = _build_freq_tiers(original_text, source_lang_code)
        translated_word_freq_tiers = _build_freq_tiers(translated_text, target_lang)

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
            "sentence_pairs": sentence_pairs,
        }

        # Save to history if user is logged in
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
        raise HTTPException(status_code=500, detail=f"An error occurred: {exc}")

    finally:
        if os.path.exists(upload_path):
            os.remove(upload_path)


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

    try:
        translated = translate_text(word, target_lang, source_lang)
        return {
            "word": word,
            "translated": translated.strip(),
            "target_lang": SUPPORTED_LANGUAGES.get(target_lang, target_lang),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Translation failed: {exc}")
