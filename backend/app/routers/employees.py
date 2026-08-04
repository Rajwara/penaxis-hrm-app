from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import hash_password
from ..deps import get_current_user, require_admin

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("", response_model=list[schemas.UserOut])
def list_employees(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin),
):
    return (
        db.query(models.User)
        .filter(models.User.is_active == 1)
        .order_by(models.User.id)
        .all()
    )


@router.post("", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def create_employee(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin),
):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = models.User(
        name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        department=payload.department,
        position=payload.position,
        phone=payload.phone,
        leave_quota=payload.leave_quota,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=schemas.UserOut)
def get_employee(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != models.Role.ADMIN and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this profile")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot remove your own account")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    # soft delete to preserve attendance/leave history
    user.is_active = 0
    db.commit()
    return None


@router.patch("/{user_id}/leave-quota", response_model=schemas.UserOut)
def update_leave_quota(
    user_id: int,
    payload: schemas.LeaveQuotaUpdate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    user.leave_quota = payload.leave_quota
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=schemas.UserOut)
def update_employee(
    user_id: int,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != models.Role.ADMIN and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this profile")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user
