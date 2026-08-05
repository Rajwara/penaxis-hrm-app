import io
import datetime as dt

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

from .. import models
from ..database import get_db
from ..deps import require_admin

router = APIRouter(prefix="/reports", tags=["reports"])

HEADER_FILL = PatternFill(start_color="734FA0", end_color="734FA0", fill_type="solid")
HEADER_FONT = Font(color="FFFFFF", bold=True)
TITLE_FONT = Font(bold=True, size=14, color="212121")


def _style_header(ws, row: int, ncols: int):
    for col in range(1, ncols + 1):
        cell = ws.cell(row=row, column=col)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center")


def _autofit(ws, ncols: int, min_width: int = 12, max_width: int = 40):
    for col in range(1, ncols + 1):
        letter = get_column_letter(col)
        max_len = min_width
        for cell in ws[letter]:
            if cell.value is not None:
                max_len = max(max_len, len(str(cell.value)) + 2)
        ws.column_dimensions[letter].width = min(max_len, max_width)


def _hours_worked(check_in, check_out) -> str:
    if not check_in or not check_out:
        return ""
    delta = check_out - check_in
    return f"{delta.total_seconds() / 3600:.1f}"


@router.get("/employees-excel")
def export_employees_excel(
    start_date: dt.date | None = Query(None, description="Filter attendance/leaves from this date (inclusive)"),
    end_date: dt.date | None = Query(None, description="Filter attendance/leaves up to this date (inclusive)"),
    db: Session = Depends(get_db),
    _admin: models.User = Depends(require_admin),
):
    if start_date and end_date and end_date < start_date:
        start_date, end_date = end_date, start_date

    employees = (
        db.query(models.User)
        .filter(models.User.is_active == 1)
        .order_by(models.User.department, models.User.name)
        .all()
    )

    wb = Workbook()

    # --- Sheet 1: Employees overview ---
    ws1 = wb.active
    ws1.title = "Employees"
    headers1 = [
        "Name", "Email", "Department", "Position", "Role",
        "Phone", "Join Date", "Leave Quota (days)",
    ]
    ws1.append(headers1)
    _style_header(ws1, 1, len(headers1))
    for emp in employees:
        ws1.append([
            emp.name, emp.email, emp.department, emp.position,
            emp.role.value, emp.phone or "", emp.join_date.isoformat(),
            emp.leave_quota,
        ])
    ws1.freeze_panes = "A2"
    _autofit(ws1, len(headers1))

    # --- Sheet 2: Attendance ---
    ws2 = wb.create_sheet("Attendance")
    headers2 = [
        "Employee", "Department", "Date", "Check In", "Check Out", "Hours Worked",
    ]
    ws2.append(headers2)
    _style_header(ws2, 1, len(headers2))
    attendance_q = (
        db.query(models.Attendance)
        .join(models.User)
        .filter(models.User.is_active == 1)
    )
    if start_date:
        attendance_q = attendance_q.filter(models.Attendance.date >= start_date)
    if end_date:
        attendance_q = attendance_q.filter(models.Attendance.date <= end_date)
    attendance_rows = attendance_q.order_by(
        models.Attendance.date.desc(), models.Attendance.check_in.desc()
    ).all()
    for rec in attendance_rows:
        ws2.append([
            rec.user.name,
            rec.user.department,
            rec.date.isoformat(),
            rec.check_in.strftime("%Y-%m-%d %H:%M") if rec.check_in else "",
            rec.check_out.strftime("%Y-%m-%d %H:%M") if rec.check_out else "",
            _hours_worked(rec.check_in, rec.check_out),
        ])
    ws2.freeze_panes = "A2"
    _autofit(ws2, len(headers2))

    # --- Sheet 3: Leaves ---
    ws3 = wb.create_sheet("Leaves")
    headers3 = [
        "Employee", "Department", "Leave Type", "Start Date", "End Date",
        "Days", "Status", "Reason", "Submitted At", "Decided At",
    ]
    ws3.append(headers3)
    _style_header(ws3, 1, len(headers3))
    leave_q = (
        db.query(models.LeaveRequest)
        .join(models.User)
        .filter(models.User.is_active == 1)
    )
    if start_date:
        # include leaves that overlap the range at all, not just ones starting inside it
        leave_q = leave_q.filter(models.LeaveRequest.end_date >= start_date)
    if end_date:
        leave_q = leave_q.filter(models.LeaveRequest.start_date <= end_date)
    leave_rows = leave_q.order_by(models.LeaveRequest.created_at.desc()).all()
    for lv in leave_rows:
        ws3.append([
            lv.user.name,
            lv.user.department,
            lv.leave_type.value,
            lv.start_date.isoformat(),
            lv.end_date.isoformat(),
            lv.days,
            lv.status.value,
            lv.reason,
            lv.created_at.strftime("%Y-%m-%d %H:%M"),
            lv.decided_at.strftime("%Y-%m-%d %H:%M") if lv.decided_at else "",
        ])
    ws3.freeze_panes = "A2"
    _autofit(ws3, len(headers3))

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    if start_date and end_date:
        suffix = f"{start_date.isoformat()}_to_{end_date.isoformat()}"
    else:
        suffix = dt.date.today().isoformat()
    filename = f"penaxis-hr-report-{suffix}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
