from .database import SessionLocal
from . import models
from .security import hash_password


def run():
    db = SessionLocal()
    try:
        existing = db.query(models.User).first()
        if existing:
            return
        admin = models.User(
            name="Alex Morgan",
            email="admin@company.com",
            hashed_password=hash_password("admin123"),
            role=models.Role.ADMIN,
            department="Human Resources",
            position="HR Manager",
            leave_quota=18,
        )
        demo_employee = models.User(
            name="Jamie Chen",
            email="employee@company.com",
            hashed_password=hash_password("employee123"),
            role=models.Role.EMPLOYEE,
            department="Engineering",
            position="Software Engineer",
            leave_quota=12,
        )
        db.add_all([admin, demo_employee])
        db.commit()
    finally:
        db.close()
