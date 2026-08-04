import os
import uuid

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.environ.get("HRM_DATA_DIR", BASE_DIR)
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_DOC_BYTES = 10 * 1024 * 1024  # 10 MB

ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_DOC_EXT = {".pdf", ".doc", ".docx"}


def save_upload(content: bytes, original_filename: str, allowed_ext: set[str]) -> str:
    """Saves file bytes under a unique name in UPLOAD_DIR, returns the stored filename."""
    ext = os.path.splitext(original_filename)[1].lower()
    if ext not in allowed_ext:
        raise ValueError(f"Unsupported file type: {ext or 'unknown'}")
    stored_name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, stored_name)
    with open(path, "wb") as f:
        f.write(content)
    return stored_name


def delete_upload(stored_name: str | None):
    if not stored_name:
        return
    path = os.path.join(UPLOAD_DIR, stored_name)
    if os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            pass
