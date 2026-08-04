export type Role = "admin" | "employee";

export interface UserOut {
  id: number;
  name: string;
  email: string;
  role: Role;
  department: string;
  position: string;
  phone: string;
  join_date: string;
  leave_quota: number;
  is_active: number;
}

export interface AttendanceOut {
  id: number;
  user_id: number;
  date: string;
  check_in: string | null;
  check_out: string | null;
}

export type LeaveType = "annual" | "sick" | "casual" | "unpaid" | "other";
export type LeaveStatus = "pending" | "approved" | "rejected";

export interface LeaveOut {
  id: number;
  user_id: number;
  start_date: string;
  end_date: string;
  leave_type: LeaveType;
  reason: string;
  status: LeaveStatus;
  days: number;
  created_at: string;
  decided_at: string | null;
}

export interface LeaveOutWithUser extends LeaveOut {
  user_name: string;
  user_department: string;
}
