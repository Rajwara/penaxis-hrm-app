"""
Manual, one-off export of every employee record (and their uploaded
documents) for backup purposes - e.g. before a provider migration, or to
keep an out-of-band copy while a hosting issue is being resolved.

This is NOT run automatically by the app. Run it by hand, from a machine
that can reach your database (this repo's sandbox/dev environment usually
can't - your own laptop, or a machine on the same network as the DB, can).

Usage:
    cd backend
    pip install -r requirements.txt
    DATABASE_URL="<your Postgres connection string>" \
    BACKEND_BASE_URL="<your running backend's public URL, e.g. https://your-app.up.railway.app>" \
    python scripts/export_people_data.py

DATABASE_URL is required. BACKEND_BASE_URL is optional - if set and the
backend is reachable, uploaded documents (CVs, CNIC images, profile
pictures) are downloaded too; if omitted, only the structured database
fields are exported.

Produces, in ./export_output/ (relative to wherever you run this from):
  - employees.csv    one row per employee (including soft-deleted / removed
                      ones), all personal/HR fields except the password hash
  - employees.json    the same data, full fidelity
  - uploads/<file>    every referenced CV/CNIC/profile-picture file, if
                      BACKEND_BASE_URL was provided and reachable
"""

import csv
import json
import os
import sys
import urllib.request
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models

OUTPUT_DIR = os.path.join(os.getcwd(), "export_output")
UPLOADS_DIR = os.path.join(OUTPUT_DIR, "uploads")

FIELDS = [
    "id", "name", "email", "role", "department", "position", "phone",
    "join_date", "leave_quota", "is_active", "employment_type",
    "permanent_conversion_date", "internship_end_date_override",
    "linkedin_url", "blood_group", "years_experience", "birthday",
    "skills_json", "profile_picture", "cv_filename", "cv_original_name",
    "cnic_filename", "cnic_original_name", "manager_id", "is_team_manager",
    "is_super_admin", "can_view_cnic", "can_view_sensitive_info",
    "can_view_birthdays",
]


def _normalize_db_url(raw_url: str) -> str:
    if raw_url.startswith("postgres://"):
        raw_url = raw_url.replace("postgres://", "postgresql://", 1)
    if raw_url.startswith("postgresql://") and "+" not in raw_url.split("://")[0]:
        raw_url = raw_url.replace("postgresql://", "postgresql+pg8000://", 1)
    return raw_url


def _row_dict(user: models.User) -> dict:
    row = {}
    for field in FIELDS:
        value = getattr(user, field)
        if hasattr(value, "value"):  # enum columns (role, employment_type)
            value = value.value
        elif hasattr(value, "isoformat"):  # date columns
            value = value.isoformat()
        row[field] = value
    return row


def _download_upload(base_url: str, filename: str) -> None:
    if not filename:
        return
    dest = os.path.join(UPLOADS_DIR, filename)
    if os.path.exists(dest):
        return
    url = f"{base_url.rstrip('/')}/uploads/{filename}"
    try:
        with urllib.request.urlopen(url, timeout=30) as resp, open(dest, "wb") as f:
            f.write(resp.read())
        print(f"  downloaded {filename}")
    except (urllib.error.URLError, urllib.error.HTTPError) as e:
        print(f"  WARNING: could not download {filename}: {e}")


def main() -> None:
    raw_url = os.environ.get("DATABASE_URL")
    if not raw_url:
        print("ERROR: set DATABASE_URL to your Postgres connection string first.")
        sys.exit(1)

    backend_base_url = os.environ.get("BACKEND_BASE_URL")

    engine = create_engine(_normalize_db_url(raw_url))
    Session = sessionmaker(bind=engine)
    db = Session()

    users = db.query(models.User).order_by(models.User.id).all()
    print(f"Found {len(users)} employee record(s) (including any soft-deleted).")

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    rows = [_row_dict(u) for u in users]

    csv_path = os.path.join(OUTPUT_DIR, "employees.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {csv_path}")

    json_path = os.path.join(OUTPUT_DIR, "employees.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2, default=str)
    print(f"Wrote {json_path}")

    if backend_base_url:
        os.makedirs(UPLOADS_DIR, exist_ok=True)
        print(f"Downloading uploaded documents from {backend_base_url} ...")
        for u in users:
            _download_upload(backend_base_url, u.profile_picture)
            _download_upload(backend_base_url, u.cv_filename)
            _download_upload(backend_base_url, u.cnic_filename)
    else:
        print(
            "BACKEND_BASE_URL not set - skipped downloading uploaded documents "
            "(CVs/CNIC images/profile pictures). Set it and re-run to fetch those too."
        )

    print("Done.")


if __name__ == "__main__":
    main()
