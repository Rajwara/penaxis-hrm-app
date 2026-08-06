import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_admin

router = APIRouter(prefix="/attendance", tags=["attendance"])


def _find_open_session(db: Session, user_id: int, day: dt.date) -> models.Attendance | None:
    """A session that's been checked in but not yet checked out."""
    return (
        db.query(models.Attendance)
        .filter(
            models.Attendance.user_id == user_id,
            models.Attendance.date == day,
            models.Attendance.check_out.is_(None),
        )
        .order_by(models.Attendance.check_in.desc())
        .first()
    )


@router.post("/checkin", response_model=schemas.AttendanceOut)
def check_in(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    today = dt.date.today()
    if _find_open_session(db, current_user.id, today):
        raise HTTPException(
            status_code=400,
            detail="You're already checked in. Check out before starting a new session.",
        )
    session = models.Attendance(
        user_id=current_user.id, date=today, check_in=dt.datetime.now()
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/checkout", response_model=schemas.AttendanceOut)
def check_out(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    today = dt.date.today()
    session = _find_open_session(db, current_user.id, today)
    if not session:
        raise HTTPException(status_code=400, detail="You need to check in before checking out")
    session.check_out = dt.datetime.now()
    db.commit()
    db.refresh(session)
    return session


@router.get("/today", response_model=list[schemas.AttendanceOut])
def today_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    today = dt.date.today()
    return (
        db.query(models.Attendance)
        .filter(
            models.Attendance.user_id == current_user.id,
            models.Attendance.date == today,
        )
        .order_by(models.Attendance.check_in)
        .all()
    )


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
    return q.order_by(models.Attendance.date.desc(), models.Attendance.check_in.desc()).all()


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
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if target and target.is_super_admin and current_user.id != user_id and not current_user.is_super_admin:
        raise HTTPException(status_code=404, detail="Employee not found")
    q = db.query(models.Attendance).filter(models.Attendance.user_id == user_id)
    if month:
        q = q.filter(extract("month", models.Attendance.date) == month)
    if year:
        q = q.filter(extract("year", models.Attendance.date) == year)
    return q.order_by(models.Attendance.date.desc(), models.Attendance.check_in.desc()).all()


@router.get("", response_model=list[schemas.AttendanceOutWithUser])
def team_attendance(
    user_id: int | None = Query(None, description="Filter to a single employee"),
    start_date: dt.date | None = Query(None),
    end_date: dt.date | None = Query(None),
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    """
    Team-wide attendance view for Admin/HR (and super admins): every check-in
    and check-out across all employees, optionally narrowed to one employee
    and/or a date range. Backs the "Team Attendance" page.
    """
    q = db.query(models.Attendance).join(models.User, models.Attendance.user_id == models.User.id)
    if not admin.is_super_admin:
        # Regular admins can't see super-admin accounts anywhere, including here.
        q = q.filter(models.User.is_super_admin == False)  # noqa: E712
    if user_id is not None:
        q = q.filter(models.Attendance.user_id == user_id)
    if start_date is not None:
        q = q.filter(models.Attendance.date >= start_date)
    if end_date is not None:
        q = q.filter(models.Attendance.date <= end_date)

    rows = q.order_by(models.Attendance.date.desc(), models.Attendance.check_in.desc()).all()
    return [
        schemas.AttendanceOutWithUser(
            id=r.id,
            user_id=r.user_id,
            date=r.date,
            check_in=r.check_in,
            check_out=r.check_out,
            user_name=r.user.name,
            user_department=r.user.department,
        )
        for r in rows
    ]
