"""Translation API routes — FastAPI endpoints for the React frontend."""

import os
import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import settings
from app.services.pdf_parser import extract_text_from_pdf
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
        translated_text = translate_text(original_text, target_lang)
        word_map = build_word_map(original_text, target_lang)
        sentence_pairs = build_sentence_alignment(original_text, translated_text)

        return {
            "filename": pdf_file.filename,
            "target_lang": SUPPORTED_LANGUAGES[target_lang],
            "target_lang_code": target_lang,
            "original_text": original_text,
            "translated_text": translated_text,
            "word_map": word_map,
            "sentence_pairs": sentence_pairs,
        }

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
):
    """Translate a single word or short phrase to the target language."""

    if target_lang not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail="Please select a valid target language.")

    word = word.strip()
    if not word:
        raise HTTPException(status_code=400, detail="No word provided.")

    try:
        translated = translate_text(word, target_lang)
        return {
            "word": word,
            "translated": translated.strip(),
            "target_lang": SUPPORTED_LANGUAGES[target_lang],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Translation failed: {exc}")
