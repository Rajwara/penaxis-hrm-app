import datetime as dt
from typing import Optional

from pydantic import BaseModel, EmailStr, ConfigDict

from .models import Role, LeaveStatus, LeaveType, EmploymentType


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
    leave_quota: float = 0.0
    manager_id: Optional[int] = None
    employment_type: EmploymentType = EmploymentType.PERMANENT
    is_team_manager: bool = False


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    department: Optional[str] = None
    position: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    years_experience: Optional[float] = None
    birthday: Optional[dt.date] = None
    skills: Optional[list[str]] = None
    blood_group: Optional[str] = None
    manager_id: Optional[int] = None
    employment_type: Optional[EmploymentType] = None
    permanent_conversion_date: Optional[dt.date] = None
    is_team_manager: Optional[bool] = None
    role: Optional[Role] = None


class LeaveQuotaUpdate(BaseModel):
    leave_quota: float


class InternshipFeedbackCreate(BaseModel):
    feedback: str


class PasswordReset(BaseModel):
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


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
    blood_group: Optional[str] = None
    profile_picture_url: Optional[str] = None
    cv_url: Optional[str] = None
    cv_original_name: Optional[str] = None
    cnic_url: Optional[str] = None
    cnic_original_name: Optional[str] = None
    manager_id: Optional[int] = None
    manager_name: Optional[str] = None
    is_manager: bool = False
    is_team_manager: bool = False
    is_super_admin: bool = False
    can_view_cnic: bool = False
    is_eligible_for_annual_leave: bool = False
    annual_leave_accrued: float = 0
    annual_leave_carried_forward: float = 0
    annual_leave_balance: float = 0
    permanent_conversion_date: Optional[dt.date] = None
    is_on_probation_leave_policy: bool = False
    probation_leave_accrued: float = 0
    probation_leave_balance: float = 0
    employment_type: EmploymentType = EmploymentType.PERMANENT
    internship_end_date: Optional[dt.date] = None
    is_internship_completed: bool = False
    needs_internship_feedback: bool = False
    intern_feedback: Optional[str] = None
    intern_feedback_submitted_at: Optional[dt.datetime] = None


# ---------- Attendance ----------
class AttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    date: dt.date
    check_in: Optional[dt.datetime] = None
    check_out: Optional[dt.datetime] = None


class AttendanceOutWithUser(AttendanceOut):
    user_name: str
    user_department: str


# ---------- Leave ----------
class LeaveCreate(BaseModel):
    start_date: dt.date
    end_date: dt.date
    leave_type: LeaveType = LeaveType.ANNUAL
    reason: str = ""
    is_short_leave: bool = False


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
    is_short_leave: bool = False
    created_at: dt.datetime
    decided_at: Optional[dt.datetime] = None


class LeaveOutWithUser(LeaveOut):
    user_name: str = ""
    user_department: str = ""
