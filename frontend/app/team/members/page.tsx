"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { api } from "@/lib/api";
import { UserOut } from "@/lib/types";
import { formatDate } from "@/lib/format";

export default function MyTeamPage() {
  const [team, setTeam] = useState<UserOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<UserOut[]>("/employees/my-team")
      .then((res) => setTeam(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="My Team" subtitle="Everyone who reports to you" managerOnly>
      {loading ? (
        <p className="py-8 text-center text-sm text-ink-400">Loading…</p>
      ) : team.length === 0 ? (
        <div className="card py-8 text-center text-sm text-ink-400">
          No one is assigned to report to you yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((member) => {
            const initials = member.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <div key={member.id} className="card">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-500 text-sm font-semibold text-white">
                    {initials}
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                      {member.name}
                      {member.employment_type === "permanent" && <VerifiedBadge />}
                    </p>
                    <p className="text-xs text-ink-400">{member.position}</p>
                  </div>
                </div>
                <dl className="mt-4 space-y-1.5 border-t border-ink-100 pt-3 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-ink-400">Department</dt>
                    <dd className="text-ink-700">{member.department}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-400">Type</dt>
                    <dd className="capitalize text-ink-700">{member.employment_type}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-400">Email</dt>
                    <dd className="truncate text-ink-700">{member.email}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-400">Joined</dt>
                    <dd className="text-ink-700">{formatDate(member.join_date)}</dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
