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
        src="/team-photo.jpg"
        alt=""
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0" style={{ backgroundColor: "rgb(115 79 160 / 51%)" }} />

      <div
        className="relative z-10 w-full max-w-md rounded-2xl px-6 py-8"
        style={{ backgroundColor: "rgba(33, 33, 33, 0.28)" }}
      >
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
      </div>
    </div>
  );
}
