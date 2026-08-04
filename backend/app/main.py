from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import auth, employees, attendance, leaves, reports
from . import seed

Base.metadata.create_all(bind=engine)
seed.run()

app = FastAPI(title="HRM API", version="1.0.0")

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
