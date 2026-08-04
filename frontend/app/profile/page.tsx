"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { AttendanceOut, LeaveOut } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";

export default function ProfilePage() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceOut[]>([]);
  const [leaves, setLeaves] = useState<LeaveOut[]>([]);

  useEffect(() => {
    if (!user) return;
    const now = new Date();
    api
      .get<AttendanceOut[]>("/attendance/me", {
        params: { month: now.getMonth() + 1, year: now.getFullYear() },
      })
      .then((res) => setAttendance(res.data));
    api.get<LeaveOut[]>("/leaves/me").then((res) => setLeaves(res.data));
  }, [user]);

  const daysPresent = attendance.filter((a) => a.check_in).length;
  const approvedLeaves = leaves.filter((l) => l.status === "approved").length;

  const initials = (user?.name || "?")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <AppShell title="My profile" subtitle="Your personal details and history">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-500 text-xl font-semibold text-white">
              {initials}
            </div>
            <p className="font-display text-lg font-bold text-ink-900">{user?.name}</p>
            <p className="text-sm text-ink-400">{user?.position}</p>
            <span className="mt-2 rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium capitalize text-ink-600">
              {user?.role === "admin" ? "HR / Admin" : "Employee"}
            </span>
          </div>

          <dl className="mt-6 space-y-3 border-t border-ink-100 pt-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-400">Email</dt>
              <dd className="text-ink-800">{user?.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-400">Department</dt>
              <dd className="text-ink-800">{user?.department}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-400">Phone</dt>
              <dd className="text-ink-800">{user?.phone || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-400">Joined</dt>
              <dd className="text-ink-800">{user && formatDate(user.join_date)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-400">Leave balance</dt>
              <dd className="font-semibold text-ink-800">{user?.leave_quota} days</dd>
            </div>
          </dl>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="card text-center">
              <p className="font-display text-2xl font-bold text-ink-900">{daysPresent}</p>
              <p className="text-xs text-ink-400">Days present (this month)</p>
            </div>
            <div className="card text-center">
              <p className="font-display text-2xl font-bold text-ink-900">{approvedLeaves}</p>
              <p className="text-xs text-ink-400">Leaves approved</p>
            </div>
            <div className="card text-center">
              <p className="font-display text-2xl font-bold text-ink-900">{user?.leave_quota}</p>
              <p className="text-xs text-ink-400">Days remaining</p>
            </div>
          </div>

          <div className="card">
            <p className="mb-4 text-sm font-semibold text-ink-800">Recent leave records</p>
            {leaves.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-400">No leave records yet.</p>
            ) : (
              <ul className="space-y-3">
                {leaves.slice(0, 6).map((lv) => (
                  <li key={lv.id} className="flex items-center justify-between border-b border-ink-50 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium text-ink-800 capitalize">{lv.leave_type} leave</p>
                      <p className="text-xs text-ink-400">
                        {formatDate(lv.start_date)} – {formatDate(lv.end_date)} · {lv.days} day(s)
                      </p>
                    </div>
                    <StatusPill status={lv.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
