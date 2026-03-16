"""Translation routes — upload PDF, translate, display side-by-side."""

import os
import uuid

from flask import (
    Blueprint,
    current_app,
    flash,
    redirect,
    render_template,
    request,
    url_for,
)

from app.services.pdf_parser import extract_text_from_pdf
from app.services.translator import SUPPORTED_LANGUAGES, translate_text
from app.utils.helpers import allowed_file

translation_bp = Blueprint("translation", __name__)


@translation_bp.route("/", methods=["GET"])
def index():
    """Render the upload / home page."""
    return render_template("index.html", languages=SUPPORTED_LANGUAGES)


@translation_bp.route("/translate", methods=["POST"])
def translate():
    """Handle PDF upload, extract text, translate, and show results."""

    # --- validate file ---
    if "pdf_file" not in request.files:
        flash("No file selected.", "error")
        return redirect(url_for("translation.index"))

    file = request.files["pdf_file"]
    if file.filename == "" or file.filename is None:
        flash("No file selected.", "error")
        return redirect(url_for("translation.index"))

    if not allowed_file(file.filename):
        flash("Only PDF files are allowed.", "error")
        return redirect(url_for("translation.index"))

    # --- validate language ---
    target_lang = request.form.get("target_lang", "")
    if target_lang not in SUPPORTED_LANGUAGES:
        flash("Please select a valid target language.", "error")
        return redirect(url_for("translation.index"))

    # --- save uploaded file ---
    unique_name = f"{uuid.uuid4().hex}_{file.filename}"
    upload_path = os.path.join(current_app.config["UPLOAD_FOLDER"], unique_name)
    file.save(upload_path)

    try:
        # --- extract & translate ---
        original_text = extract_text_from_pdf(upload_path)
        translated_text = translate_text(original_text, target_lang)

        return render_template(
            "result.html",
            original_text=original_text,
            translated_text=translated_text,
            target_lang=SUPPORTED_LANGUAGES[target_lang],
            filename=file.filename,
            languages=SUPPORTED_LANGUAGES,
        )

    except ValueError as exc:
        flash(str(exc), "error")
        return redirect(url_for("translation.index"))

    except Exception as exc:
        flash(f"An error occurred: {exc}", "error")
        return redirect(url_for("translation.index"))

    finally:
        # Clean up the uploaded file
        if os.path.exists(upload_path):
            os.remove(upload_path)
