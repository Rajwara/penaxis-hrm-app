"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api";
import { UserOut } from "@/lib/types";
import { MONTH_NAMES } from "@/lib/format";

interface BirthdayEntry {
  user: UserOut;
  month: number;
  day: number;
  daysUntil: number;
  isToday: boolean;
}

function computeBirthdays(employees: UserOut[]): BirthdayEntry[] {
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const entries: BirthdayEntry[] = [];
  for (const user of employees) {
    if (!user.birthday) continue;
    // birthday is stored as "YYYY-MM-DD"; parse month/day only, ignore stored year
    const [, monthStr, dayStr] = user.birthday.split("-");
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);

    let next = new Date(today.getFullYear(), month - 1, day);
    if (next < todayMidnight) {
      next = new Date(today.getFullYear() + 1, month - 1, day);
    }
    const daysUntil = Math.round((next.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));

    entries.push({ user, month, day, daysUntil, isToday: daysUntil === 0 });
  }

  entries.sort((a, b) => a.daysUntil - b.daysUntil);
  return entries;
}

function relativeLabel(daysUntil: number): string {
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  if (daysUntil <= 7) return `In ${daysUntil} days`;
  if (daysUntil <= 30) return `In ${Math.round(daysUntil / 7)} week(s)`;
  return `In ${Math.round(daysUntil / 30)} month(s)`;
}

export default function BirthdaysPage() {
  const [employees, setEmployees] = useState<UserOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<UserOut[]>("/employees")
      .then((res) => setEmployees(res.data))
      .finally(() => setLoading(false));
  }, []);

  const birthdays = useMemo(() => computeBirthdays(employees), [employees]);
  const withoutBirthday = employees.filter((e) => !e.birthday);

  // Group into months for display, in upcoming order
  const grouped = useMemo(() => {
    const groups: { month: number; entries: BirthdayEntry[] }[] = [];
    for (const entry of birthdays) {
      let group = groups.find((g) => g.month === entry.month);
      if (!group) {
        group = { month: entry.month, entries: [] };
        groups.push(group);
      }
      group.entries.push(entry);
    }
    return groups;
  }, [birthdays]);

  return (
    <AppShell title="Birthdays" subtitle="Everyone's birthday, sorted by what's coming up next" adminOnly>
      {loading ? (
        <p className="py-8 text-center text-sm text-ink-400">Loading…</p>
      ) : birthdays.length === 0 ? (
        <div className="card py-8 text-center text-sm text-ink-400">
          No one has a birthday on file yet. Employees can add theirs from their Profile page.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.month} className="card">
              <p className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-ink-400">
                {MONTH_NAMES[group.month - 1]}
              </p>
              <ul className="divide-y divide-ink-50">
                {group.entries.map((entry) => (
                  <li
                    key={entry.user.id}
                    className={`flex items-center justify-between py-3 ${
                      entry.isToday ? "rounded-lg bg-amber-400/10 px-3" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {entry.isToday && <span className="text-lg">🎂</span>}
                      <div>
                        <p className="text-sm font-medium text-ink-800">{entry.user.name}</p>
                        <p className="text-xs text-ink-400">
                          {entry.user.position} · {entry.user.department}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm text-ink-700">
                        {MONTH_NAMES[entry.month - 1].slice(0, 3)} {entry.day}
                      </p>
                      <p
                        className={`text-xs ${
                          entry.isToday ? "font-semibold text-amber-600" : "text-ink-400"
                        }`}
                      >
                        {relativeLabel(entry.daysUntil)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {withoutBirthday.length > 0 && (
            <div className="card">
              <p className="mb-2 text-sm font-semibold text-ink-800">
                No birthday on file ({withoutBirthday.length})
              </p>
              <p className="text-xs text-ink-400">
                {withoutBirthday.map((e) => e.name).join(", ")}
              </p>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
