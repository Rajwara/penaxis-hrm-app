import datetime as dt
from typing import Optional

from pydantic import BaseModel, EmailStr, ConfigDict

from .models import Role, LeaveStatus, LeaveType


# ---------- Auth ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


# ---------- User ----------
class UserBase(BaseModel):
    name: str
    email: EmailStr
    department: str = "General"
    position: str = "Staff"
    phone: str = ""


class UserCreate(UserBase):
    password: str
    role: Role = Role.EMPLOYEE
    leave_quota: float = 12.0
    manager_id: Optional[int] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    years_experience: Optional[float] = None
    birthday: Optional[dt.date] = None
    skills: Optional[list[str]] = None
    manager_id: Optional[int] = None


class LeaveQuotaUpdate(BaseModel):
    leave_quota: float


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: Role
    join_date: dt.date
    leave_quota: float
    is_active: int
    linkedin_url: str = ""
    years_experience: float = 0
    birthday: Optional[dt.date] = None
    skills: list[str] = []
    profile_picture_url: Optional[str] = None
    cv_url: Optional[str] = None
    cv_original_name: Optional[str] = None
    manager_id: Optional[int] = None
    manager_name: Optional[str] = None
    is_manager: bool = False


# ---------- Attendance ----------
class AttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    date: dt.date
    check_in: Optional[dt.datetime] = None
    check_out: Optional[dt.datetime] = None


# ---------- Leave ----------
class LeaveCreate(BaseModel):
    start_date: dt.date
    end_date: dt.date
    leave_type: LeaveType = LeaveType.ANNUAL
    reason: str = ""


class LeaveStatusUpdate(BaseModel):
    status: LeaveStatus


class LeaveOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    start_date: dt.date
    end_date: dt.date
    leave_type: LeaveType
    reason: str
    status: LeaveStatus
    days: float
    created_at: dt.datetime
    decided_at: Optional[dt.datetime] = None


class LeaveOutWithUser(LeaveOut):
    user_name: str = ""
    user_department: str = ""
