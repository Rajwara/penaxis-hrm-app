import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_admin

router = APIRouter(prefix="/attendance", tags=["attendance"])


@router.post("/checkin", response_model=schemas.AttendanceOut)
def check_in(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    today = dt.date.today()
    record = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.user_id == current_user.id,
            models.Attendance.date == today,
        )
        .first()
    )
    if record and record.check_in:
        raise HTTPException(status_code=400, detail="Already checked in today")
    if not record:
        record = models.Attendance(user_id=current_user.id, date=today)
        db.add(record)
    record.check_in = dt.datetime.now()
    db.commit()
    db.refresh(record)
    return record


@router.post("/checkout", response_model=schemas.AttendanceOut)
def check_out(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    today = dt.date.today()
    record = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.user_id == current_user.id,
            models.Attendance.date == today,
        )
        .first()
    )
    if not record or not record.check_in:
        raise HTTPException(status_code=400, detail="You must check in before checking out")
    if record.check_out:
        raise HTTPException(status_code=400, detail="Already checked out today")
    record.check_out = dt.datetime.now()
    db.commit()
    db.refresh(record)
    return record


@router.get("/today", response_model=schemas.AttendanceOut | None)
def today_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    today = dt.date.today()
    record = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.user_id == current_user.id,
            models.Attendance.date == today,
        )
        .first()
    )
    return record


@router.get("/me", response_model=list[schemas.AttendanceOut])
def my_attendance(
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None, ge=2000, le=2100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.Attendance).filter(models.Attendance.user_id == current_user.id)
    if month:
        q = q.filter(extract("month", models.Attendance.date) == month)
    if year:
        q = q.filter(extract("year", models.Attendance.date) == year)
    return q.order_by(models.Attendance.date.desc()).all()


@router.get("/user/{user_id}", response_model=list[schemas.AttendanceOut])
def user_attendance(
    user_id: int,
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None, ge=2000, le=2100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != models.Role.ADMIN and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    q = db.query(models.Attendance).filter(models.Attendance.user_id == user_id)
    if month:
        q = q.filter(extract("month", models.Attendance.date) == month)
    if year:
        q = q.filter(extract("year", models.Attendance.date) == year)
    return q.order_by(models.Attendance.date.desc()).all()
