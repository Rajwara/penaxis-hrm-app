"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api";
import { AttendanceOut } from "@/lib/types";
import { formatDate, formatTime, MONTH_NAMES, parseAsUTC } from "@/lib/format";

function hoursWorked(record: AttendanceOut): string {
  if (!record.check_in || !record.check_out) return "-";
  const ms = parseAsUTC(record.check_out).getTime() - parseAsUTC(record.check_in).getTime();
  const hrs = ms / (1000 * 60 * 60);
  return `${hrs.toFixed(1)}h`;
}

export default function AttendancePage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [records, setRecords] = useState<AttendanceOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<AttendanceOut[]>("/attendance/me", { params: { month, year } })
      .then((res) => setRecords(res.data))
      .finally(() => setLoading(false));
  }, [month, year]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <AppShell title="Attendance" subtitle="Your daily check-in and check-out history">
      <div className="card">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="input w-auto"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="input w-auto"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <span className="ml-auto text-sm text-ink-400">{records.length} day(s) recorded</span>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-ink-400">Loading…</p>
        ) : records.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-400">No attendance recorded for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Check in</th>
                  <th className="pb-3 pr-4">Check out</th>
                  <th className="pb-3">Hours</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-ink-50 last:border-0">
                    <td className="py-3 pr-4 font-medium text-ink-800">{formatDate(r.date)}</td>
                    <td className="py-3 pr-4 font-mono text-ink-600">{formatTime(r.check_in)}</td>
                    <td className="py-3 pr-4 font-mono text-ink-600">{formatTime(r.check_out)}</td>
                    <td className="py-3 font-mono text-ink-600">{hoursWorked(r)}</td>
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
