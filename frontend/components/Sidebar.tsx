"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const employeeLinks = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/attendance", label: "Attendance", icon: "clock" },
  { href: "/leaves", label: "Leave", icon: "calendar" },
  { href: "/profile", label: "Profile", icon: "user" },
];

const adminLinks = [
  { href: "/admin/employees", label: "Employees", icon: "users" },
  { href: "/admin/leaves", label: "Leave requests", icon: "calendar" },
  { href: "/profile", label: "My profile", icon: "user" },
];

function Icon({ name }: { name: string }) {
  const common = "h-[18px] w-[18px]";
  switch (name) {
    case "grid":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "clock":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" strokeLinecap="round" />
        </svg>
      );
    case "calendar":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
        </svg>
      );
    case "user":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" strokeLinecap="round" />
        </svg>
      );
    case "users":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 19c0-3.3 2.9-5 6.5-5s6.5 1.7 6.5 5" strokeLinecap="round" />
          <path d="M16 4.5c1.5.3 2.6 1.6 2.6 3.1S17.5 10.4 16 10.7M19 14.2c1.7.5 3 1.8 3 4.3" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

export function Sidebar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const links = user?.role === "admin" ? adminLinks : employeeLinks;

  return (
    <aside className="hidden w-60 flex-col border-r border-ink-100 bg-white px-4 py-6 md:flex">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 font-display text-sm font-bold text-white">
          P
        </div>
        <span className="font-display text-lg font-bold text-ink-900">Penaxis HR</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-ink-900 text-white"
                  : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
              }`}
            >
              <Icon name={link.icon} />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="rounded-lg bg-ink-50 px-3 py-3 text-xs text-ink-400">
        Signed in as <span className="font-medium text-ink-600">{user?.role === "admin" ? "HR / Admin" : "Employee"}</span>
      </div>
    </aside>
  );
}
