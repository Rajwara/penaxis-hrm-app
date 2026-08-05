"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({
  title,
  subtitle,
  adminOnly = false,
  managerOnly = false,
  children,
}: {
  title: string;
  subtitle?: string;
  adminOnly?: boolean;
  managerOnly?: boolean;
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const isAdmin = user?.role === "admin";
  const isManagerOrAdmin = isAdmin || !!user?.is_manager;

  const forbidden =
    (adminOnly && !isAdmin) || (managerOnly && !isManagerOrAdmin);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (forbidden) {
      router.replace("/dashboard");
    }
  }, [user, loading, forbidden, router]);

  if (loading || !user || forbidden) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-50">
        <p className="text-sm text-ink-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-ink-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto px-6 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
