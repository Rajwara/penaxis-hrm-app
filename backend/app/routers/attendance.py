import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_super_admin

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
    current_user: models.User = Depends(get_current_user),
):
    """
    Team attendance view: every check-in and check-out across all employees
    for Admin/HR (and super admins), or just their direct reports for a
    manager, optionally narrowed to one employee and/or a date range. Backs
    the "Team Attendance" page (admin) and the manager-facing team attendance page.
    """
    q = db.query(models.Attendance).join(models.User, models.Attendance.user_id == models.User.id)
    if current_user.role != models.Role.ADMIN:
        # Managers only see attendance for people who report to them
        q = q.filter(models.User.manager_id == current_user.id)
    elif not current_user.is_super_admin:
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


@router.post("", response_model=schemas.AttendanceOut, status_code=201)
def create_attendance(
    payload: schemas.AttendanceCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_super_admin),
):
    """
    Manual attendance entry for fixing forgotten punches or logging a late
    arrival that was never recorded. Super-admin only.
    """
    target = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Employee not found")
    if payload.check_in is None and payload.check_out is None:
        raise HTTPException(
            status_code=400, detail="At least one of check_in or check_out is required"
        )
    if (
        payload.check_in is not None
        and payload.check_out is not None
        and payload.check_out <= payload.check_in
    ):
        raise HTTPException(status_code=400, detail="Check-out must be after check-in")

    record = models.Attendance(
        user_id=payload.user_id,
        date=payload.date,
        check_in=payload.check_in,
        check_out=payload.check_out,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.patch("/{attendance_id}", response_model=schemas.AttendanceOut)
def update_attendance(
    attendance_id: int,
    payload: schemas.AttendanceUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_super_admin),
):
    """Super-admin correction of an existing attendance record."""
    record = db.query(models.Attendance).filter(models.Attendance.id == attendance_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    updates = payload.model_dump(exclude_unset=True)
    check_in = updates.get("check_in", record.check_in)
    check_out = updates.get("check_out", record.check_out)
    if check_in is None and check_out is None:
        raise HTTPException(
            status_code=400, detail="At least one of check_in or check_out is required"
        )
    if check_in is not None and check_out is not None and check_out <= check_in:
        raise HTTPException(status_code=400, detail="Check-out must be after check-in")

    for field, value in updates.items():
        setattr(record, field, value)
    db.commit()
    db.refresh(record)
    return record
