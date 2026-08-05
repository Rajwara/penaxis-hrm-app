import enum
import json
import calendar
import datetime as dt

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Date,
    DateTime,
    ForeignKey,
    Enum,
    Text,
)
from sqlalchemy.orm import relationship, object_session

from .database import Base

# Company leave policy: 18 annual leave days per calendar year, accrued monthly.
ANNUAL_LEAVE_PER_YEAR = 18.0
MONTHLY_ACCRUAL = ANNUAL_LEAVE_PER_YEAR / 12  # 1.5 days/month
ANNUAL_LEAVE_ELIGIBILITY_DAYS = 365  # must have completed 1 year to use annual leave
INTERNSHIP_MONTHS = 3


def _add_months(d: dt.date, months: int) -> dt.date:
    total_month = d.month - 1 + months
    year = d.year + total_month // 12
    month = total_month % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return dt.date(year, month, day)


class Role(str, enum.Enum):
    ADMIN = "admin"
    EMPLOYEE = "employee"


class EmploymentType(str, enum.Enum):
    PERMANENT = "permanent"
    CONTRACT = "contract"
    INTERN = "intern"


class LeaveStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class LeaveType(str, enum.Enum):
    ANNUAL = "annual"
    SICK = "sick"
    CASUAL = "casual"
    UNPAID = "unpaid"
    OTHER = "other"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(Role), default=Role.EMPLOYEE, nullable=False)
    department = Column(String, default="General")
    position = Column(String, default="Staff")
    phone = Column(String, default="")
    join_date = Column(Date, default=dt.date.today)
    leave_quota = Column(Float, default=0.0)  # manual adjustment on top of accrued annual leave
    is_active = Column(Integer, default=1)  # 1 active, 0 removed (soft delete)
    employment_type = Column(Enum(EmploymentType), default=EmploymentType.PERMANENT, nullable=False)
    intern_feedback = Column(Text, nullable=True)
    intern_feedback_submitted_at = Column(DateTime, nullable=True)

    # Extended profile fields
    linkedin_url = Column(String, default="")
    years_experience = Column(Float, default=0)
    birthday = Column(Date, nullable=True)
    skills_json = Column(Text, default="[]")
    profile_picture = Column(String, nullable=True)  # stored filename
    cv_filename = Column(String, nullable=True)  # stored filename on disk
    cv_original_name = Column(String, nullable=True)  # original uploaded filename

    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    manager = relationship("User", remote_side=[id], backref="reports")

    @property
    def manager_name(self) -> str | None:
        return self.manager.name if self.manager else None

    @property
    def is_manager(self) -> bool:
        return len(self.reports) > 0

    @property
    def skills(self) -> list[str]:
        try:
            return json.loads(self.skills_json or "[]")
        except (json.JSONDecodeError, TypeError):
            return []

    @skills.setter
    def skills(self, value: list[str]):
        self.skills_json = json.dumps(value or [])

    @property
    def profile_picture_url(self) -> str | None:
        return f"/uploads/{self.profile_picture}" if self.profile_picture else None

    @property
    def cv_url(self) -> str | None:
        return f"/uploads/{self.cv_filename}" if self.cv_filename else None

    @property
    def internship_end_date(self) -> dt.date | None:
        if self.employment_type != EmploymentType.INTERN or not self.join_date:
            return None
        return _add_months(self.join_date, INTERNSHIP_MONTHS)

    @property
    def is_internship_completed(self) -> bool:
        end = self.internship_end_date
        return end is not None and dt.date.today() >= end

    @property
    def needs_internship_feedback(self) -> bool:
        return self.is_internship_completed and not self.intern_feedback

    @property
    def is_eligible_for_annual_leave(self) -> bool:
        """Annual leave can only be used after completing one year with the company."""
        if not self.join_date:
            return False
        return (dt.date.today() - self.join_date).days >= ANNUAL_LEAVE_ELIGIBILITY_DAYS

    @property
    def annual_leave_accrued(self) -> float:
        """
        18 days/year, accrued at 1.5/month starting the month they joined
        (or January 1st, for anyone who joined in a prior year).
        """
        if not self.join_date:
            return 0.0
        today = dt.date.today()
        year_start = dt.date(today.year, 1, 1)
        effective_start = max(self.join_date, year_start)
        if effective_start > today:
            return 0.0
        months_elapsed = (
            (today.year - effective_start.year) * 12
            + (today.month - effective_start.month)
            + 1
        )
        months_elapsed = max(0, months_elapsed)
        return round(min(ANNUAL_LEAVE_PER_YEAR, months_elapsed * MONTHLY_ACCRUAL), 2)

    @property
    def annual_leave_used_this_year(self) -> float:
        session = object_session(self)
        if session is None:
            return 0.0
        today = dt.date.today()
        rows = (
            session.query(LeaveRequest)
            .filter(
                LeaveRequest.user_id == self.id,
                LeaveRequest.leave_type == LeaveType.ANNUAL,
                LeaveRequest.status == LeaveStatus.APPROVED,
            )
            .all()
        )
        return sum(r.days for r in rows if r.start_date.year == today.year)

    @property
    def annual_leave_balance(self) -> float:
        """Accrued this year + any manual adjustment, minus approved annual leave already taken."""
        return round(
            self.annual_leave_accrued + (self.leave_quota or 0) - self.annual_leave_used_this_year,
            2,
        )

    attendances = relationship(
        "Attendance", back_populates="user", cascade="all, delete-orphan"
    )
    leaves = relationship(
        "LeaveRequest", back_populates="user", cascade="all, delete-orphan"
    )


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, default=dt.date.today, nullable=False)
    check_in = Column(DateTime, nullable=True)
    check_out = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="attendances")


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    leave_type = Column(Enum(LeaveType), default=LeaveType.ANNUAL)
    reason = Column(Text, default="")
    status = Column(Enum(LeaveStatus), default=LeaveStatus.PENDING)
    days = Column(Float, default=1.0)
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    decided_at = Column(DateTime, nullable=True)
    decided_by = Column(Integer, nullable=True)

    user = relationship("User", back_populates="leaves")
