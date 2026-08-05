import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# If DATABASE_URL is set (e.g. Railway Postgres, added as a service), use it —
# this is a real persistent database, so data survives every redeploy.
# Otherwise fall back to a local SQLite file, for local development only.
_raw_url = os.environ.get("DATABASE_URL")

if _raw_url:
    # Some providers (Railway/Heroku-style) hand out "postgres://"; normalize to
    # "postgresql://" and force the pg8000 driver explicitly. pg8000 is pure
    # Python (no libpq.so dependency), which avoids native-library issues that
    # can crash psycopg2-binary on certain container images.
    if _raw_url.startswith("postgres://"):
        _raw_url = _raw_url.replace("postgres://", "postgresql://", 1)
    if _raw_url.startswith("postgresql://") and "+" not in _raw_url.split("://")[0]:
        _raw_url = _raw_url.replace("postgresql://", "postgresql+pg8000://", 1)
    DATABASE_URL = _raw_url
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
else:
    DATA_DIR = os.environ.get("HRM_DATA_DIR", BASE_DIR)
    os.makedirs(DATA_DIR, exist_ok=True)
    DATABASE_URL = f"sqlite:///{os.path.join(DATA_DIR, 'hrm.db')}"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
