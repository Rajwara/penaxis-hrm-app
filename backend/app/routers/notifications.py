import datetime as dt

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import extract

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/birthdays-today", response_model=list[schemas.UserOut])
def birthdays_today(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Surfaces whose birthday is today, scoped to who should actually see it:
    HR/Admin sees everyone's; a manager sees their own direct reports';
    anyone else sees none — this isn't a company-wide announcement, just a
    heads-up for the people who'd want to acknowledge it.
    """
    today = dt.date.today()
    base = db.query(models.User).filter(
        models.User.is_active == 1,
        models.User.birthday.isnot(None),
        extract("month", models.User.birthday) == today.month,
        extract("day", models.User.birthday) == today.day,
    )

    if current_user.role == models.Role.ADMIN:
        if not current_user.is_super_admin:
            base = base.filter(
                (models.User.is_super_admin == False)  # noqa: E712
                | (models.User.id == current_user.id)
            )
        return base.all()

    if current_user.is_manager:
        return base.filter(models.User.manager_id == current_user.id).all()

    return []
