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
  - employees.csv          one row per employee (including soft-deleted /
                            removed ones), all personal/HR fields except
                            the password hash
  - employees.json         the same data, full fidelity
  - birthdays.xlsx         everyone's date of birth, sorted by what's coming
                            up next (same ordering as the app's own
                            Birthdays page)
  - documents/cvs/              every employee's CV, named "<name> - <original
                                 filename>" so it's actually browsable
  - documents/cnics/             same, for CNIC images
  - documents/profile_pictures/  same, for profile pictures
  (all three only if BACKEND_BASE_URL was provided and reachable - the
  files are stored under opaque generated names, so this download step is
  what makes them identifiable by employee)
"""

import csv
import datetime as dt
import json
import os
import re
import sys
import urllib.request
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from openpyxl import Workbook

from app import models
from app.routers.reports import _style_header, _autofit

OUTPUT_DIR = os.path.join(os.getcwd(), "export_output")
DOCUMENTS_DIR = os.path.join(OUTPUT_DIR, "documents")
CVS_DIR = os.path.join(DOCUMENTS_DIR, "cvs")
CNICS_DIR = os.path.join(DOCUMENTS_DIR, "cnics")
PROFILE_PICTURES_DIR = os.path.join(DOCUMENTS_DIR, "profile_pictures")

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


def _safe_filename(name: str) -> str:
    return re.sub(r'[\\/:*?"<>|]+', "_", name).strip()


def _download_upload(base_url: str, stored_filename: str, dest_path: str) -> None:
    if not stored_filename:
        return
    if os.path.exists(dest_path):
        return
    url = f"{base_url.rstrip('/')}/uploads/{stored_filename}"
    try:
        with urllib.request.urlopen(url, timeout=30) as resp, open(dest_path, "wb") as f:
            f.write(resp.read())
        print(f"  downloaded {os.path.relpath(dest_path, OUTPUT_DIR)}")
    except (urllib.error.URLError, urllib.error.HTTPError) as e:
        print(f"  WARNING: could not download {stored_filename}: {e}")


def _days_until_next_birthday(birthday: dt.date, today: dt.date) -> int:
    next_bday = dt.date(today.year, birthday.month, birthday.day)
    if next_bday < today:
        next_bday = dt.date(today.year + 1, birthday.month, birthday.day)
    return (next_bday - today).days


def _write_birthdays_xlsx(users: list, path: str) -> None:
    today = dt.date.today()
    with_birthday = [u for u in users if u.is_active and u.birthday]
    with_birthday.sort(key=lambda u: _days_until_next_birthday(u.birthday, today))

    wb = Workbook()
    ws = wb.active
    ws.title = "Birthdays"
    headers = ["Name", "Department", "Position", "Date of Birth", "Next Birthday", "Days Until"]
    ws.append(headers)
    _style_header(ws, 1, len(headers))
    for u in with_birthday:
        days_until = _days_until_next_birthday(u.birthday, today)
        next_bday = dt.date(today.year, u.birthday.month, u.birthday.day)
        if next_bday < today:
            next_bday = dt.date(today.year + 1, u.birthday.month, u.birthday.day)
        ws.append([
            u.name, u.department, u.position,
            u.birthday.isoformat(), next_bday.isoformat(), days_until,
        ])
    ws.freeze_panes = "A2"
    _autofit(ws, len(headers))
    wb.save(path)


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

    xlsx_path = os.path.join(OUTPUT_DIR, "birthdays.xlsx")
    _write_birthdays_xlsx(users, xlsx_path)
    print(f"Wrote {xlsx_path}")

    if backend_base_url:
        os.makedirs(CVS_DIR, exist_ok=True)
        os.makedirs(CNICS_DIR, exist_ok=True)
        os.makedirs(PROFILE_PICTURES_DIR, exist_ok=True)
        print(f"Downloading uploaded documents from {backend_base_url} ...")
        for u in users:
            safe_name = _safe_filename(u.name)
            if u.cv_filename:
                ext = os.path.splitext(u.cv_filename)[1]
                original = u.cv_original_name or f"cv{ext}"
                _download_upload(
                    backend_base_url, u.cv_filename,
                    os.path.join(CVS_DIR, f"{safe_name} - {original}"),
                )
            if u.cnic_filename:
                ext = os.path.splitext(u.cnic_filename)[1]
                original = u.cnic_original_name or f"cnic{ext}"
                _download_upload(
                    backend_base_url, u.cnic_filename,
                    os.path.join(CNICS_DIR, f"{safe_name} - {original}"),
                )
            if u.profile_picture:
                ext = os.path.splitext(u.profile_picture)[1]
                _download_upload(
                    backend_base_url, u.profile_picture,
                    os.path.join(PROFILE_PICTURES_DIR, f"{safe_name}{ext}"),
                )
    else:
        print(
            "BACKEND_BASE_URL not set - skipped downloading uploaded documents "
            "(CVs/CNIC images/profile pictures). Set it and re-run to fetch those too."
        )

    print("Done.")


if __name__ == "__main__":
    main()
