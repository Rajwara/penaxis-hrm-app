"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { api, apiErrorMessage } from "@/lib/api";
import { AttendanceCreate, AttendanceOutWithUser, AttendanceUpdate, UserOut } from "@/lib/types";
import {
  formatDate,
  formatTime,
  todayInKarachi,
  hoursWorked,
  karachiLocalToNaiveUTC,
  naiveUTCToKarachiLocalParts,
} from "@/lib/format";

const EMPTY_ADD_FORM = { user_id: "", date: todayInKarachi(), check_in_time: "", check_out_time: "" };

export default function AdminAttendancePage() {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = !!currentUser?.is_super_admin;

  const [employees, setEmployees] = useState<UserOut[]>([]);
  const [records, setRecords] = useState<AttendanceOutWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [employeeId, setEmployeeId] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>(todayInKarachi());
  const [endDate, setEndDate] = useState<string>(todayInKarachi());

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
  const [addError, setAddError] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [editingAttendanceId, setEditingAttendanceId] = useState<number | null>(null);
  const [editAttendanceForm, setEditAttendanceForm] = useState({ date: "", check_in_time: "", check_out_time: "" });
  const [editAttendanceError, setEditAttendanceError] = useState("");
  const [editAttendanceSubmitting, setEditAttendanceSubmitting] = useState(false);

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

  async function handleCreateAttendance(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    if (!addForm.user_id) {
      setAddError("Select an employee");
      return;
    }
    if (!addForm.check_in_time && !addForm.check_out_time) {
      setAddError("Enter at least a check-in or check-out time");
      return;
    }
    setAddSubmitting(true);
    try {
      const payload: AttendanceCreate = {
        user_id: Number(addForm.user_id),
        date: addForm.date,
        check_in: addForm.check_in_time ? karachiLocalToNaiveUTC(addForm.date, addForm.check_in_time) : null,
        check_out: addForm.check_out_time ? karachiLocalToNaiveUTC(addForm.date, addForm.check_out_time) : null,
      };
      await api.post("/attendance", payload);
      setShowAddForm(false);
      setAddForm(EMPTY_ADD_FORM);
      await load();
    } catch (err) {
      setAddError(apiErrorMessage(err, "Could not add attendance entry"));
    } finally {
      setAddSubmitting(false);
    }
  }

  function handleEditAttendanceOpen(r: AttendanceOutWithUser) {
    setEditingAttendanceId(r.id);
    setEditAttendanceError("");
    setEditAttendanceForm({
      date: r.date,
      check_in_time: r.check_in ? naiveUTCToKarachiLocalParts(r.check_in).time : "",
      check_out_time: r.check_out ? naiveUTCToKarachiLocalParts(r.check_out).time : "",
    });
  }

  async function handleSaveAttendanceEdit() {
    if (editingAttendanceId === null) return;
    setEditAttendanceSubmitting(true);
    setEditAttendanceError("");
    try {
      const payload: AttendanceUpdate = {
        date: editAttendanceForm.date,
        check_in: editAttendanceForm.check_in_time
          ? karachiLocalToNaiveUTC(editAttendanceForm.date, editAttendanceForm.check_in_time)
          : null,
        check_out: editAttendanceForm.check_out_time
          ? karachiLocalToNaiveUTC(editAttendanceForm.date, editAttendanceForm.check_out_time)
          : null,
      };
      await api.patch(`/attendance/${editingAttendanceId}`, payload);
      setEditingAttendanceId(null);
      await load();
    } catch (err) {
      setEditAttendanceError(apiErrorMessage(err, "Could not save changes"));
    } finally {
      setEditAttendanceSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Team Attendance"
      subtitle="Check-in and check-out records across the whole team"
      adminOnly
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
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

        {isSuperAdmin && (
          <button
            onClick={() => {
              setAddError("");
              setShowAddForm((v) => !v);
            }}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            {showAddForm ? "Cancel" : "+ Add manual entry"}
          </button>
        )}
      </div>

      {isSuperAdmin && showAddForm && (
        <form onSubmit={handleCreateAttendance} className="card mb-5">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Employee</label>
              <select
                value={addForm.user_id}
                onChange={(e) => setAddForm({ ...addForm, user_id: e.target.value })}
                className="rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-800 focus:border-brand-500 focus:outline-none"
              >
                <option value="">Select employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Date</label>
              <input
                type="date"
                value={addForm.date}
                onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
                className="rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-800 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Check-in</label>
              <input
                type="time"
                value={addForm.check_in_time}
                onChange={(e) => setAddForm({ ...addForm, check_in_time: e.target.value })}
                className="rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-800 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Check-out</label>
              <input
                type="time"
                value={addForm.check_out_time}
                onChange={(e) => setAddForm({ ...addForm, check_out_time: e.target.value })}
                className="rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-800 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={addSubmitting}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {addSubmitting ? "Saving…" : "Save"}
            </button>
          </div>
          {addError && (
            <div className="mt-3 rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">{addError}</div>
          )}
        </form>
      )}

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
                  {isSuperAdmin && <th className="pb-3 pl-4">Actions</th>}
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
                    {isSuperAdmin && (
                      <td className="py-3 pl-4">
                        <button
                          onClick={() => handleEditAttendanceOpen(r)}
                          className="text-xs font-medium text-brand-600 hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isSuperAdmin && editingAttendanceId !== null && (
        <div className="card mt-5">
          <p className="mb-3 text-sm font-semibold text-ink-800">Edit attendance record</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Date</label>
              <input
                type="date"
                value={editAttendanceForm.date}
                onChange={(e) => setEditAttendanceForm({ ...editAttendanceForm, date: e.target.value })}
                className="rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-800 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Check-in</label>
              <input
                type="time"
                value={editAttendanceForm.check_in_time}
                onChange={(e) => setEditAttendanceForm({ ...editAttendanceForm, check_in_time: e.target.value })}
                className="rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-800 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Check-out</label>
              <input
                type="time"
                value={editAttendanceForm.check_out_time}
                onChange={(e) => setEditAttendanceForm({ ...editAttendanceForm, check_out_time: e.target.value })}
                className="rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-800 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveAttendanceEdit}
                disabled={editAttendanceSubmitting}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
              >
                {editAttendanceSubmitting ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setEditingAttendanceId(null)}
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-ink-600 ring-1 ring-ink-100 hover:bg-ink-50"
              >
                Cancel
              </button>
            </div>
          </div>
          {editAttendanceError && (
            <div className="mt-3 rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">{editAttendanceError}</div>
          )}
        </div>
      )}
    </AppShell>
  );
}
