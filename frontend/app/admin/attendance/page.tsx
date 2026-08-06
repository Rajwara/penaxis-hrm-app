"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api";
import { AttendanceOutWithUser, UserOut } from "@/lib/types";
import { formatDate, formatTime, todayInKarachi } from "@/lib/format";

function hoursWorked(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return "-";
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  if (ms <= 0) return "-";
  const hrs = ms / (1000 * 60 * 60);
  return `${hrs.toFixed(1)}h`;
}

export default function AdminAttendancePage() {
  const [employees, setEmployees] = useState<UserOut[]>([]);
  const [records, setRecords] = useState<AttendanceOutWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [employeeId, setEmployeeId] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    api.get<UserOut[]>("/employees").then((res) => setEmployees(res.data));
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (employeeId !== "all") params.user_id = employeeId;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const res = await api.get<AttendanceOutWithUser[]>("/attendance", { params });
      setRecords(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, startDate, endDate]);

  function setPreset(preset: "today" | "week" | "clear") {
    if (preset === "clear") {
      setStartDate("");
      setEndDate("");
      return;
    }
    const today = todayInKarachi();
    if (preset === "today") {
      setStartDate(today);
      setEndDate(today);
    } else {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(today);
    }
  }

  return (
    <AppShell
      title="Team Attendance"
      subtitle="Check-in and check-out records across the whole team"
      adminOnly
    >
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-500">Employee</label>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-800 focus:border-brand-500 focus:outline-none"
          >
            <option value="all">All employees</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-500">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-800 focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-500">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-800 focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-2 pb-0.5">
          <button
            onClick={() => setPreset("today")}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink-600 ring-1 ring-ink-100 hover:bg-ink-50"
          >
            Today
          </button>
          <button
            onClick={() => setPreset("week")}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink-600 ring-1 ring-ink-100 hover:bg-ink-50"
          >
            Last 7 days
          </button>
          <button
            onClick={() => setPreset("clear")}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink-600 ring-1 ring-ink-100 hover:bg-ink-50"
          >
            Clear dates
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p className="py-8 text-center text-sm text-ink-400">Loading…</p>
        ) : records.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-400">No attendance records match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="pb-3 pr-4">Employee</th>
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Check In</th>
                  <th className="pb-3 pr-4">Check Out</th>
                  <th className="pb-3">Hours</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-ink-50 last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-ink-800">{r.user_name}</p>
                      <p className="text-xs text-ink-400">{r.user_department}</p>
                    </td>
                    <td className="py-3 pr-4 text-ink-600">{formatDate(r.date)}</td>
                    <td className="py-3 pr-4 text-ink-600">{formatTime(r.check_in)}</td>
                    <td className="py-3 pr-4 text-ink-600">{formatTime(r.check_out)}</td>
                    <td className="py-3 text-ink-600">{hoursWorked(r.check_in, r.check_out)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
