"use client";

import { useAuth } from "@/lib/auth-context";
import { fileUrl } from "@/lib/api";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user, logout } = useAuth();

  const initials = (user?.name || "?")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const pictureSrc = fileUrl(user?.profile_picture_url);

  return (
    <header className="flex items-center justify-between border-b border-ink-100 bg-white px-6 py-4 md:px-8">
      <div>
        <h1 className="font-display text-xl font-bold text-ink-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-400">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-ink-800">{user?.name}</p>
          <p className="text-xs text-ink-400">{user?.position}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-teal-500 text-sm font-semibold text-white">
          {pictureSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pictureSrc} alt={user?.name} className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <button
          onClick={logout}
          className="rounded-lg border border-ink-100 px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
