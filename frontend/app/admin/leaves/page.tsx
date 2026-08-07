"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api";
import { LeaveOutWithUser, LeaveStatus } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";

const FILTERS: { value: LeaveStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

export default function AdminLeavesPage() {
  const [leaves, setLeaves] = useState<LeaveOutWithUser[]>([]);
  const [filter, setFilter] = useState<LeaveStatus | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = filter === "all" ? {} : { status_filter: filter };
      const res = await api.get<LeaveOutWithUser[]>("/leaves", { params });
      setLeaves(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function decide(id: number, status: "approved" | "rejected") {
    setBusyId(id);
    try {
      await api.patch(`/leaves/${id}/status`, { status });
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Could not update this request");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell title="Leave requests" subtitle="Review and decide on employee leave" adminOnly>
      <div className="mb-5 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-ink-900 text-white"
                : "bg-white text-ink-600 ring-1 ring-ink-100 hover:bg-ink-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <p className="py-8 text-center text-sm text-ink-400">Loading…</p>
        ) : leaves.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-400">No requests in this view.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="pb-3 pr-4">Employee</th>
                  <th className="pb-3 pr-4">Dates</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Days</th>
                  <th className="pb-3 pr-4">Reason</th>
                  <th className="pb-3 pr-4">Submitted</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((lv) => (
                  <tr key={lv.id} className="border-b border-ink-50 last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-ink-800">{lv.user_name}</p>
                      <p className="text-xs text-ink-400">{lv.user_department}</p>
                    </td>
                    <td className="py-3 pr-4 text-ink-600">
                      {formatDate(lv.start_date)} – {formatDate(lv.end_date)}
                    </td>
                    <td className="py-3 pr-4 capitalize text-ink-600">
                      {lv.is_short_leave ? "Short Leave" : lv.leave_type}
                    </td>
                    <td className="py-3 pr-4 text-ink-600">{lv.days}</td>
                    <td className="max-w-[160px] truncate py-3 pr-4 text-ink-600">{lv.reason}</td>
                    <td className="py-3 pr-4 text-ink-400">{formatDateTime(lv.created_at)}</td>
                    <td className="py-3 pr-4">
                      <StatusPill status={lv.status} />
                    </td>
                    <td className="py-3">
                      {lv.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            disabled={busyId === lv.id}
                            onClick={() => decide(lv.id, "approved")}
                            className="text-xs font-semibold text-success hover:opacity-70"
                          >
                            Approve
                          </button>
                          <button
                            disabled={busyId === lv.id}
                            onClick={() => decide(lv.id, "rejected")}
                            className="text-xs font-semibold text-danger hover:opacity-70"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
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
