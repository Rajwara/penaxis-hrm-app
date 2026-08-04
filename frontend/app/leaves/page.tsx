"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { api, apiErrorMessage } from "@/lib/api";
import { LeaveOut, LeaveType } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";

const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: "annual", label: "Annual" },
  { value: "sick", label: "Sick" },
  { value: "casual", label: "Casual" },
  { value: "unpaid", label: "Unpaid" },
  { value: "other", label: "Other" },
];

export default function LeavesPage() {
  const { user, refreshUser } = useAuth();
  const [leaves, setLeaves] = useState<LeaveOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<LeaveOut[]>("/leaves/me");
      setLeaves(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      await api.post("/leaves", {
        start_date: startDate,
        end_date: endDate,
        leave_type: leaveType,
        reason,
      });
      setSuccess("Leave request submitted.");
      setStartDate("");
      setEndDate("");
      setReason("");
      setLeaveType("annual");
      await Promise.all([load(), refreshUser()]);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not submit leave request"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Leave" subtitle="Apply for time off and track your requests">
      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={handleSubmit} className="card space-y-4 lg:col-span-1">
          <div>
            <p className="label mb-0">Leave balance</p>
            <p className="font-display text-2xl font-bold text-ink-900">{user?.leave_quota} days</p>
          </div>

          {error && <div className="rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">{error}</div>}
          {success && (
            <div className="rounded-lg bg-success/10 px-3 py-2.5 text-sm text-success">{success}</div>
          )}

          <div>
            <label className="label">Leave type</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
              className="input"
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">End date</label>
              <input
                type="date"
                required
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">Reason</label>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="input resize-none"
              placeholder="Brief reason for your leave"
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Submitting…" : "Submit request"}
          </button>
        </form>

        <div className="card lg:col-span-2">
          <p className="mb-4 text-sm font-semibold text-ink-800">Your requests</p>
          {loading ? (
            <p className="py-8 text-center text-sm text-ink-400">Loading…</p>
          ) : leaves.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">No leave requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                    <th className="pb-3 pr-4">Dates</th>
                    <th className="pb-3 pr-4">Type</th>
                    <th className="pb-3 pr-4">Days</th>
                    <th className="pb-3 pr-4">Reason</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((lv) => (
                    <tr key={lv.id} className="border-b border-ink-50 last:border-0">
                      <td className="py-3 pr-4 text-ink-800">
                        {formatDate(lv.start_date)} – {formatDate(lv.end_date)}
                      </td>
                      <td className="py-3 pr-4 capitalize text-ink-600">{lv.leave_type}</td>
                      <td className="py-3 pr-4 text-ink-600">{lv.days}</td>
                      <td className="max-w-[180px] truncate py-3 pr-4 text-ink-600">{lv.reason}</td>
                      <td className="py-3">
                        <StatusPill status={lv.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
