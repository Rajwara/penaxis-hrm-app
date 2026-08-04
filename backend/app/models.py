import enum
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
from sqlalchemy.orm import relationship

from .database import Base


class Role(str, enum.Enum):
    ADMIN = "admin"
    EMPLOYEE = "employee"


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
    leave_quota = Column(Float, default=12.0)  # remaining leave days
    is_active = Column(Integer, default=1)  # 1 active, 0 removed (soft delete)

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
