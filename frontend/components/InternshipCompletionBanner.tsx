"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, apiErrorMessage } from "@/lib/api";

export function InternshipCompletionBanner() {
  const { user, refreshUser } = useAuth();
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!user || !user.needs_internship_feedback) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!feedback.trim() || !user) return;
    setError("");
    setSubmitting(true);
    try {
      await api.post(`/employees/${user.id}/internship-feedback`, { feedback });
      await refreshUser();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not submit your feedback"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card mb-6 border-brand-100 bg-brand-50/40">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🎓</span>
        <div className="flex-1">
          <p className="font-display text-lg font-bold text-ink-900">
            Your internship at Penaxis is complete!
          </p>
          <p className="mt-1 text-sm text-ink-600">
            Congratulations on finishing your 3 months with us. We'd love to hear how it went —
            your thoughts help us make the program better for the next intern.
          </p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            {error && (
              <div className="rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">{error}</div>
            )}
            <label className="label">How was your experience at Penaxis? Share your thoughts.</label>
            <textarea
              required
              rows={4}
              className="input resize-none"
              placeholder="Tell us about your time here — what you learned, what stood out, anything we could do better…"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Submitting…" : "Submit feedback"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
