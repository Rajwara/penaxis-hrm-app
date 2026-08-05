from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import Base, engine
from .routers import auth, employees, attendance, leaves, reports
from . import seed
from .storage import UPLOAD_DIR
from .migrations import run_lightweight_migrations

run_lightweight_migrations(engine, Base)
Base.metadata.create_all(bind=engine)
seed.run()

app = FastAPI(title="HRM API", version="1.0.0")

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://penaxis-hrm-app.vercel.app",
    ],
    allow_origin_regex=r"https://penaxis-hrm-app.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(attendance.router)
app.include_router(leaves.router)
app.include_router(reports.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "HRM API"}
