import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import hash_password
from ..deps import get_current_user, require_admin
from ..storage import (
    save_upload,
    delete_upload,
    ALLOWED_IMAGE_EXT,
    ALLOWED_DOC_EXT,
    MAX_IMAGE_BYTES,
    MAX_DOC_BYTES,
)

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
        manager_id=payload.manager_id,
        employment_type=payload.employment_type,
        is_team_manager=payload.is_team_manager,
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


@router.post("/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(
    user_id: int,
    payload: schemas.PasswordReset,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return None


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

    updates = payload.model_dump(exclude_unset=True)
    # Employees editing their own profile cannot change org-controlled fields
    if current_user.role != models.Role.ADMIN:
        updates.pop("department", None)
        updates.pop("position", None)
        updates.pop("manager_id", None)
        updates.pop("employment_type", None)
        updates.pop("is_team_manager", None)
        updates.pop("role", None)
    elif "manager_id" in updates and updates["manager_id"] == user_id:
        raise HTTPException(status_code=400, detail="An employee cannot be their own manager")

    for field, value in updates.items():
        setattr(user, field, value)  # skills uses the model's property setter
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/internship-feedback", response_model=schemas.UserOut)
def submit_internship_feedback(
    user_id: int,
    payload: schemas.InternshipFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.id != user_id:
        raise HTTPException(
            status_code=403, detail="You can only submit your own internship feedback"
        )
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    if user.employment_type != models.EmploymentType.INTERN:
        raise HTTPException(
            status_code=400, detail="This form only applies to internship accounts"
        )
    if not user.is_internship_completed:
        raise HTTPException(
            status_code=400, detail="Your internship period hasn't ended yet"
        )
    user.intern_feedback = payload.feedback
    user.intern_feedback_submitted_at = dt.datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/profile-picture", response_model=schemas.UserOut)
async def upload_profile_picture(
    user_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != models.Role.ADMIN and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this profile")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")

    content = await file.read()
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image must be under 5 MB")
    try:
        stored_name = save_upload(content, file.filename or "photo", ALLOWED_IMAGE_EXT)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    delete_upload(user.profile_picture)
    user.profile_picture = stored_name
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/cv", response_model=schemas.UserOut)
async def upload_cv(
    user_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != models.Role.ADMIN and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this profile")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")

    content = await file.read()
    if len(content) > MAX_DOC_BYTES:
        raise HTTPException(status_code=400, detail="File must be under 10 MB")
    try:
        stored_name = save_upload(content, file.filename or "cv", ALLOWED_DOC_EXT)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    delete_upload(user.cv_filename)
    user.cv_filename = stored_name
    user.cv_original_name = file.filename
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/cnic", response_model=schemas.UserOut)
async def upload_cnic(
    user_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != models.Role.ADMIN and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this profile")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Once uploaded, an employee can't replace or remove it themselves —
    # only HR/Admin can update it from that point on.
    if current_user.role != models.Role.ADMIN and user.cnic_filename:
        raise HTTPException(
            status_code=400,
            detail="Your CNIC has already been submitted. Contact HR if it needs to be corrected.",
        )

    content = await file.read()
    if len(content) > MAX_DOC_BYTES:
        raise HTTPException(status_code=400, detail="File must be under 10 MB")
    try:
        stored_name = save_upload(content, file.filename or "cnic", ALLOWED_IMAGE_EXT | ALLOWED_DOC_EXT)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    delete_upload(user.cnic_filename)
    user.cnic_filename = stored_name
    user.cnic_original_name = file.filename
    db.commit()
    db.refresh(user)
    return user
