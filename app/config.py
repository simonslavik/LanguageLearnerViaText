import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))


class Settings:
    """Application settings loaded from environment variables."""

    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    UPLOAD_FOLDER: str = os.path.join(BASE_DIR, "uploads")
    MAX_UPLOAD_MB: int = 16
    ALLOWED_EXTENSIONS: set[str] = {"pdf"}


settings = Settings()
