"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { apiErrorMessage } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(apiErrorMessage(err, "Incorrect email or password"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <Image
        src="/team-photo.png"
        alt=""
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-[#734FA0]/85" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 p-2">
            <Image src="/penaxis-icon.png" alt="Penaxis" width={40} height={40} className="h-full w-full object-contain" priority />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Penaxis HR</h1>
          <p className="mt-1 text-sm text-ink-100/70">Sign in to manage attendance and leave</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">{error}</div>
          )}
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 rounded-xl2 border border-white/10 bg-white/5 p-4 text-xs text-ink-100/60">
          <p className="mb-1 font-semibold text-ink-100/80">Demo accounts</p>
          <p>HR/Admin: admin@company.com / admin123</p>
          <p>Employee: employee@company.com / employee123</p>
        </div>
      </div>
    </div>
  );
}
