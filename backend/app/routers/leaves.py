import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_admin

router = APIRouter(prefix="/leaves", tags=["leaves"])


def _business_days(start: dt.date, end: dt.date) -> float:
    if end < start:
        return 0
    days = 0
    current = start
    while current <= end:
        if current.weekday() < 5:  # Mon-Fri
            days += 1
        current += dt.timedelta(days=1)
    return float(days) if days > 0 else float((end - start).days + 1)


@router.post("", response_model=schemas.LeaveOut, status_code=201)
def apply_leave(
    payload: schemas.LeaveCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")
    days = _business_days(payload.start_date, payload.end_date)

    if payload.leave_type == models.LeaveType.ANNUAL:
        if not current_user.is_eligible_for_annual_leave:
            raise HTTPException(
                status_code=400,
                detail="Annual leave is available once you've completed one year with the company. "
                "Sick, casual, or other short leave is still available in the meantime.",
            )
        balance = current_user.annual_leave_balance
        if days > balance:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient annual leave balance. You have {balance} day(s) accrued so far this year.",
            )
    elif payload.leave_type == models.LeaveType.CASUAL and current_user.is_on_probation_leave_policy:
        # Contract/Probation and Intern staff get a flat 1 day/month casual
        # leave allowance instead of the normal pool.
        balance = current_user.probation_leave_balance
        if days > balance:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient casual leave balance. You have {balance} day(s) accrued so far "
                "(1 day per completed month).",
            )
    # Sick / other / unpaid ("short leave") remain uncapped for everyone.

    leave = models.LeaveRequest(
        user_id=current_user.id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        leave_type=payload.leave_type,
        reason=payload.reason,
        days=days,
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)
    return leave


@router.get("/me", response_model=list[schemas.LeaveOut])
def my_leaves(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.LeaveRequest)
        .filter(models.LeaveRequest.user_id == current_user.id)
        .order_by(models.LeaveRequest.created_at.desc())
        .all()
    )


@router.get("/user/{user_id}", response_model=list[schemas.LeaveOut])
def user_leaves(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != models.Role.ADMIN and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if target and target.is_super_admin and current_user.id != user_id and not current_user.is_super_admin:
        raise HTTPException(status_code=404, detail="Employee not found")
    return (
        db.query(models.LeaveRequest)
        .filter(models.LeaveRequest.user_id == user_id)
        .order_by(models.LeaveRequest.created_at.desc())
        .all()
    )


@router.get("", response_model=list[schemas.LeaveOutWithUser])
def all_leaves(
    status_filter: models.LeaveStatus | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.LeaveRequest).join(
        models.User, models.LeaveRequest.user_id == models.User.id
    )
    if current_user.role != models.Role.ADMIN:
        # Managers only see requests from people who report to them
        q = q.filter(models.User.manager_id == current_user.id)
    elif not current_user.is_super_admin:
        # Regular admins never see a super-admin's own leave requests
        q = q.filter(
            (models.User.is_super_admin == False) | (models.User.id == current_user.id)  # noqa: E712
        )
    if status_filter:
        q = q.filter(models.LeaveRequest.status == status_filter)
    leaves = q.order_by(models.LeaveRequest.created_at.desc()).all()
    result = []
    for lv in leaves:
        item = schemas.LeaveOutWithUser.model_validate(lv)
        item.user_name = lv.user.name if lv.user else ""
        item.user_department = lv.user.department if lv.user else ""
        result.append(item)
    return result


@router.patch("/{leave_id}/status", response_model=schemas.LeaveOut)
def update_leave_status(
    leave_id: int,
    payload: schemas.LeaveStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    leave = db.query(models.LeaveRequest).filter(models.LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")

    employee = leave.user
    is_allowed = current_user.role == models.Role.ADMIN or (
        employee is not None and employee.manager_id == current_user.id
    )
    if not is_allowed:
        raise HTTPException(
            status_code=403, detail="Not authorized to decide this request"
        )

    if leave.status != models.LeaveStatus.PENDING:
        raise HTTPException(status_code=400, detail="This request has already been decided")

    if payload.status == models.LeaveStatus.APPROVED and leave.leave_type == models.LeaveType.ANNUAL:
        # Re-check at approval time: balance is derived live from approved history,
        # so this re-validates in case other requests were approved in between.
        # (This leave is still pending, so it isn't counted in its own balance yet.)
        if leave.days > employee.annual_leave_balance:
            raise HTTPException(
                status_code=400,
                detail="Employee no longer has sufficient annual leave balance",
            )
    if (
        payload.status == models.LeaveStatus.APPROVED
        and leave.leave_type == models.LeaveType.CASUAL
        and employee is not None
        and employee.is_on_probation_leave_policy
    ):
        if leave.days > employee.probation_leave_balance:
            raise HTTPException(
                status_code=400,
                detail="Employee no longer has sufficient casual leave balance",
            )

    leave.status = payload.status
    leave.decided_at = dt.datetime.utcnow()
    leave.decided_by = current_user.id
    db.commit()
    db.refresh(leave)
    return leave
