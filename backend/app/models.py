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
    Boolean,
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
    # Deliberately a boolean, not a new Role enum value: Postgres enum types
    # can't easily accept new members without special migration handling,
    # and this needs to work safely on an existing production database.
    is_super_admin = Column(Boolean, default=False, nullable=False)
    department = Column(String, default="General")
    position = Column(String, default="Staff")
    phone = Column(String, default="")
    join_date = Column(Date, default=dt.date.today)
    leave_quota = Column(Float, default=0.0)  # manual adjustment on top of accrued annual leave
    is_active = Column(Integer, default=1)  # 1 active, 0 removed (soft delete)
    employment_type = Column(Enum(EmploymentType), default=EmploymentType.PERMANENT, nullable=False)
    # Set for Contract/Probation employees: the date they're scheduled to
    # convert to Permanent. Checked opportunistically (on login, and when an
    # admin views the employee list) and auto-applied once the date arrives —
    # there's no background scheduler in this app, so it's a lazy check
    # rather than a cron job.
    permanent_conversion_date = Column(Date, nullable=True)
    intern_feedback = Column(Text, nullable=True)
    intern_feedback_submitted_at = Column(DateTime, nullable=True)

    # Extended profile fields
    linkedin_url = Column(String, default="")
    blood_group = Column(String, nullable=True)
    years_experience = Column(Float, default=0)
    birthday = Column(Date, nullable=True)
    skills_json = Column(Text, default="[]")
    profile_picture = Column(String, nullable=True)  # stored filename
    cv_filename = Column(String, nullable=True)  # stored filename on disk
    cv_original_name = Column(String, nullable=True)  # original uploaded filename
    cnic_filename = Column(String, nullable=True)  # stored filename on disk
    cnic_original_name = Column(String, nullable=True)  # original uploaded filename

    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    manager = relationship("User", remote_side=[id], backref="reports")
    is_team_manager = Column(Boolean, default=False, nullable=False)  # explicit HR-granted manager status

    @property
    def manager_name(self) -> str | None:
        return self.manager.name if self.manager else None

    @property
    def is_manager(self) -> bool:
        return bool(self.is_team_manager) or len(self.reports) > 0

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
    def cnic_url(self) -> str | None:
        return f"/uploads/{self.cnic_filename}" if self.cnic_filename else None

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

    def _monthly_credits_as_of(self, as_of: dt.date) -> int:
        """
        How many monthly credits they've received by `as_of`. The first
        credit lands immediately on their join date; every credit after
        that lands on the monthly anniversary of that join date — someone
        who joined July 27th gets credit #2 on August 27th, #3 on
        September 27th, and so on (not on the 1st of each calendar month).
        """
        if not self.join_date or as_of < self.join_date:
            return 0
        n = 0
        while _add_months(self.join_date, n + 1) <= as_of:
            n += 1
        return n + 1

    def _accrued_for_year(self, year: int, as_of: dt.date | None = None) -> float:
        """Accrual for a single calendar year, as of a given date (defaults to Dec 31 of that year)."""
        if not self.join_date:
            return 0.0
        year_end = dt.date(year, 12, 31)
        as_of = min(as_of, year_end) if as_of else year_end
        year_before_start = dt.date(year - 1, 12, 31)
        credits_through_as_of = self._monthly_credits_as_of(as_of)
        credits_before_year = self._monthly_credits_as_of(year_before_start)
        credits_in_year = max(0, credits_through_as_of - credits_before_year)
        return round(min(ANNUAL_LEAVE_PER_YEAR, credits_in_year * MONTHLY_ACCRUAL), 2)

    def _used_for_year(self, year: int) -> float:
        session = object_session(self)
        if session is None:
            return 0.0
        rows = (
            session.query(LeaveRequest)
            .filter(
                LeaveRequest.user_id == self.id,
                LeaveRequest.leave_type == LeaveType.ANNUAL,
                LeaveRequest.status == LeaveStatus.APPROVED,
            )
            .all()
        )
        return sum(r.days for r in rows if r.start_date.year == year)

    @property
    def annual_leave_accrued(self) -> float:
        """
        This calendar year's accrual only (not including carry-forward from prior years),
        at 1.5 per monthly anniversary of their join date.
        """
        today = dt.date.today()
        return self._accrued_for_year(today.year, as_of=today)

    @property
    def annual_leave_used_this_year(self) -> float:
        return self._used_for_year(dt.date.today().year)

    @property
    def annual_leave_carried_forward(self) -> float:
        """Unused balance rolled forward from every prior year since they joined."""
        if not self.join_date:
            return 0.0
        today = dt.date.today()
        carry = 0.0
        for year in range(self.join_date.year, today.year):
            remainder = self._accrued_for_year(year) - self._used_for_year(year)
            carry += max(0.0, remainder)
        return round(carry, 2)

    @property
    def annual_leave_balance(self) -> float:
        """Carried-forward balance + this year's accrual + adjustment, minus leave used this year."""
        return round(
            self.annual_leave_carried_forward
            + self.annual_leave_accrued
            + (self.leave_quota or 0)
            - self.annual_leave_used_this_year,
            2,
        )

    @property
    def is_on_probation_leave_policy(self) -> bool:
        """
        Contract/Probation and Intern staff get a flat 1 day/month casual
        leave allowance instead of the normal annual-leave scheme (which
        they can't use anyway before 1 year, and Contract/Probation is
        meant to be a shorter status than that). This is unaffected by the
        annual-leave 1-year eligibility rule since it's a different leave
        type (casual), not annual leave.
        """
        return self.employment_type in (EmploymentType.CONTRACT, EmploymentType.INTERN)

    @property
    def probation_leave_accrued(self) -> float:
        """1 day per monthly anniversary of their join date, all-time (no annual
        reset — Contract/Probation and internships are short, fixed-term statuses)."""
        if not self.join_date:
            return 0.0
        return float(self._monthly_credits_as_of(dt.date.today()))

    @property
    def probation_leave_used(self) -> float:
        session = object_session(self)
        if session is None:
            return 0.0
        rows = (
            session.query(LeaveRequest)
            .filter(
                LeaveRequest.user_id == self.id,
                LeaveRequest.leave_type == LeaveType.CASUAL,
                LeaveRequest.status == LeaveStatus.APPROVED,
            )
            .all()
        )
        return sum(r.days for r in rows)

    @property
    def probation_leave_balance(self) -> float:
        return round(self.probation_leave_accrued - self.probation_leave_used, 2)

    def maybe_convert_to_permanent(self, db) -> bool:
        """
        If this is a Contract/Probation employee whose conversion date has
        arrived, flip them to Permanent and persist it. Returns True if a
        conversion happened. There's no background scheduler in this app,
        so this is called opportunistically wherever it matters (login,
        admin employee list) rather than on a timer.
        """
        if (
            self.employment_type == EmploymentType.CONTRACT
            and self.permanent_conversion_date is not None
            and dt.date.today() >= self.permanent_conversion_date
        ):
            self.employment_type = EmploymentType.PERMANENT
            db.add(self)
            db.commit()
            return True
        return False

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
    # Display-only flag: a short leave still draws from the employee's real
    # underlying pool (annual or probation/casual, same as normal), it's
    # just always exactly 0.5 days and always a single day. Deliberately not
    # a new LeaveType enum value — Postgres enums can't safely accept new
    # members on an existing database without extra migration handling.
    is_short_leave = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    decided_at = Column(DateTime, nullable=True)
    decided_by = Column(Integer, nullable=True)

    user = relationship("User", back_populates="leaves")
