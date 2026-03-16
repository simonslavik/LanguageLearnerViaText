"""Small helper utilities."""

ALLOWED_EXTENSIONS = {"pdf"}


def allowed_file(filename: str) -> bool:
    """Return True if *filename* has an allowed extension."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
