"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { api, apiErrorMessage } from "@/lib/api";
import { AttendanceOut, LeaveOut } from "@/lib/types";
import { formatTime } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="font-mono text-4xl font-semibold text-ink-900 tracking-tight">
      {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </p>
  );
}

function totalHoursToday(sessions: AttendanceOut[]): string {
  let ms = 0;
  for (const s of sessions) {
    if (s.check_in) {
      const end = s.check_out ? new Date(s.check_out) : new Date();
      ms += end.getTime() - new Date(s.check_in).getTime();
    }
  }
  return (ms / (1000 * 60 * 60)).toFixed(1);
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<AttendanceOut[]>([]);
  const [leaves, setLeaves] = useState<LeaveOut[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [todayRes, leavesRes] = await Promise.all([
        api.get<AttendanceOut[]>("/attendance/today"),
        api.get<LeaveOut[]>("/leaves/me"),
      ]);
      setSessions(todayRes.data);
      setLeaves(leavesRes.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const openSession = sessions.find((s) => s.check_in && !s.check_out);
  const hasFinishedASession = sessions.some((s) => s.check_out);

  async function handleCheckIn() {
    setBusy(true);
    setError("");
    try {
      const res = await api.post<AttendanceOut>("/attendance/checkin");
      setSessions((prev) => [...prev, res.data]);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not check in"));
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckOut() {
    setBusy(true);
    setError("");
    try {
      const res = await api.post<AttendanceOut>("/attendance/checkout");
      setSessions((prev) => prev.map((s) => (s.id === res.data.id ? res.data : s)));
    } catch (err) {
      setError(apiErrorMessage(err, "Could not check out"));
    } finally {
      setBusy(false);
    }
  }

  const pendingLeaves = leaves.filter((l) => l.status === "pending");

  return (
    <AppShell title={`Welcome back, ${user?.name?.split(" ")[0]}`} subtitle="Here's your day at a glance">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Punch clock - signature widget */}
        <div className="card lg:col-span-2 flex flex-col items-center justify-center gap-5 py-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <LiveClock />

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="text-center">
            <p className="label mb-0">Total time today</p>
            <p className="font-mono text-2xl font-semibold text-ink-800">
              {totalHoursToday(sessions)}h
            </p>
          </div>

          {!loading && (
            <>
              {!openSession && (
                <button onClick={handleCheckIn} disabled={busy} className="btn-primary px-8 py-3 text-base">
                  {hasFinishedASession ? "Check in (resume)" : "Check in"}
                </button>
              )}
              {openSession && (
                <button onClick={handleCheckOut} disabled={busy} className="btn-secondary px-8 py-3 text-base">
                  Check out {hasFinishedASession ? "(start break)" : ""}
                </button>
              )}
            </>
          )}

          {sessions.length > 0 && (
            <div className="w-full max-w-sm border-t border-ink-100 pt-4">
              <p className="label mb-2 text-center">Today's sessions</p>
              <ul className="space-y-1.5">
                {sessions.map((s, i) => (
                  <li key={s.id} className="flex items-center justify-between text-sm text-ink-600">
                    <span>Session {i + 1}</span>
                    <span className="font-mono">
                      {formatTime(s.check_in)} – {s.check_out ? formatTime(s.check_out) : "now"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Leave quota + pending */}
        <div className="flex flex-col gap-6">
          <div className="card">
            <p className="label">Leave balance</p>
            <p className="font-display text-3xl font-bold text-ink-900">
              {user?.leave_quota} <span className="text-base font-medium text-ink-400">days left</span>
            </p>
            <a href="/leaves" className="mt-3 inline-block text-sm font-medium text-teal-600 hover:text-teal-500">
              Apply for leave →
            </a>
          </div>

          <div className="card flex-1">
            <p className="label">Pending requests</p>
            {pendingLeaves.length === 0 ? (
              <p className="mt-2 text-sm text-ink-400">Nothing waiting on approval.</p>
            ) : (
              <ul className="mt-2 space-y-3">
                {pendingLeaves.slice(0, 3).map((lv) => (
                  <li key={lv.id} className="flex items-center justify-between text-sm">
                    <span className="text-ink-700 capitalize">{lv.leave_type} · {lv.days}d</span>
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
