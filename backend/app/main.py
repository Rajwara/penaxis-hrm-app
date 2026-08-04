from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import auth, employees, attendance, leaves
from . import seed

Base.metadata.create_all(bind=engine)
seed.run()

app = FastAPI(title="HRM API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(attendance.router)
app.include_router(leaves.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "HRM API"}
