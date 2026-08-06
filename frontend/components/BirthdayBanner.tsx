"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { UserOut } from "@/lib/types";

export function BirthdayBanner() {
  const [people, setPeople] = useState<UserOut[]>([]);

  useEffect(() => {
    api
      .get<UserOut[]>("/notifications/birthdays-today")
      .then((res) => setPeople(res.data))
      .catch(() => setPeople([]));
  }, []);

  if (people.length === 0) return null;

  return (
    <div className="card mb-6 border-amber-400/30 bg-amber-400/10">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🎂</span>
        <div>
          <p className="font-display text-base font-bold text-ink-900">
            {people.length === 1
              ? `It's ${people[0].name}'s birthday today!`
              : "Birthdays today"}
          </p>
          {people.length === 1 ? (
            <p className="mt-0.5 text-sm text-ink-600">
              {people[0].position} · {people[0].department} — take a moment to wish them well.
            </p>
          ) : (
            <ul className="mt-1 space-y-0.5 text-sm text-ink-600">
              {people.map((p) => (
                <li key={p.id}>
                  🎉 {p.name} — {p.position}, {p.department}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
