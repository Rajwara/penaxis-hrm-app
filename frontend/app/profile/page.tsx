"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { api, apiErrorMessage, fileUrl } from "@/lib/api";
import { AttendanceOut, LeaveOut } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";
import { VerifiedBadge } from "@/components/VerifiedBadge";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceOut[]>([]);
  const [leaves, setLeaves] = useState<LeaveOut[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadingPic, setUploadingPic] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);

  const picInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    phone: "",
    linkedin_url: "",
    years_experience: "0",
    birthday: "",
    skillsText: "",
  });

  useEffect(() => {
    if (!user) return;
    const now = new Date();
    api
      .get<AttendanceOut[]>("/attendance/me", {
        params: { month: now.getMonth() + 1, year: now.getFullYear() },
      })
      .then((res) => setAttendance(res.data));
    api.get<LeaveOut[]>("/leaves/me").then((res) => setLeaves(res.data));
    setForm({
      phone: user.phone || "",
      linkedin_url: user.linkedin_url || "",
      years_experience: String(user.years_experience ?? 0),
      birthday: user.birthday || "",
      skillsText: (user.skills || []).join(", "),
    });
  }, [user]);

  const daysPresent = attendance.filter((a) => a.check_in).length;
  const approvedLeaves = leaves.filter((l) => l.status === "approved").length;

  const initials = (user?.name || "?")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    setSaving(true);
    try {
      const skills = form.skillsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await api.patch(`/employees/${user.id}`, {
        phone: form.phone,
        linkedin_url: form.linkedin_url,
        years_experience: Number(form.years_experience) || 0,
        birthday: form.birthday || null,
        skills,
      });
      await refreshUser();
      setEditing(false);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save your profile"));
    } finally {
      setSaving(false);
    }
  }

  async function handlePictureChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setUploadingPic(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/employees/${user.id}/profile-picture`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await refreshUser();
    } catch (err) {
      alert(apiErrorMessage(err, "Could not upload photo"));
    } finally {
      setUploadingPic(false);
      if (picInputRef.current) picInputRef.current.value = "";
    }
  }

  async function handleCvChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setUploadingCv(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/employees/${user.id}/cv`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await refreshUser();
    } catch (err) {
      alert(apiErrorMessage(err, "Could not upload CV"));
    } finally {
      setUploadingCv(false);
      if (cvInputRef.current) cvInputRef.current.value = "";
    }
  }

  const pictureSrc = fileUrl(user?.profile_picture_url);

  return (
    <AppShell title="My profile" subtitle="Your personal details and history">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <button
              type="button"
              onClick={() => picInputRef.current?.click()}
              className="group relative mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-teal-500 text-2xl font-semibold text-white"
              title="Change profile picture"
            >
              {pictureSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pictureSrc} alt={user?.name} className="h-full w-full object-cover" />
              ) : (
                initials
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[11px] font-medium opacity-0 transition-opacity group-hover:opacity-100">
                {uploadingPic ? "Uploading…" : "Change"}
              </span>
            </button>
            <input
              ref={picInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handlePictureChange}
            />
            <p className="flex items-center gap-1.5 font-display text-lg font-bold text-ink-900">
              {user?.name}
              {user?.employment_type === "permanent" && <VerifiedBadge />}
            </p>
            <p className="text-sm text-ink-400">{user?.position}</p>
            <span className="mt-2 rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium capitalize text-ink-600">
              {user?.role === "admin" ? "HR / Admin" : "Employee"}
            </span>
          </div>

          {!editing ? (
            <>
              <dl className="mt-6 space-y-3 border-t border-ink-100 pt-5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-400">Email</dt>
                  <dd className="text-ink-800">{user?.email}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-400">Department</dt>
                  <dd className="text-ink-800">{user?.department}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-400">Reports to</dt>
                  <dd className="text-ink-800">{user?.manager_name || "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-400">Phone</dt>
                  <dd className="text-ink-800">{user?.phone || "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-400">Birthday</dt>
                  <dd className="text-ink-800">{user?.birthday ? formatDate(user.birthday) : "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-400">Experience</dt>
                  <dd className="text-ink-800">{user?.years_experience || 0} yrs</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-400">LinkedIn</dt>
                  <dd className="max-w-[60%] truncate text-ink-800">
                    {user?.linkedin_url ? (
                      <a href={user.linkedin_url} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">
                        View profile
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-400">Joined</dt>
                  <dd className="text-ink-800">{user && formatDate(user.join_date)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-400">Annual leave balance</dt>
                  <dd className="font-semibold text-ink-800">{user?.annual_leave_balance} days</dd>
                </div>
                {user && !user.is_eligible_for_annual_leave && (
                  <p className="text-right text-xs text-ink-400">
                    Usable after 1 year (accruing at 1.5/mo)
                  </p>
                )}
              </dl>

              <div className="mt-5 border-t border-ink-100 pt-5">
                <p className="label mb-2">Skills</p>
                {user?.skills && user.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {user.skills.map((s) => (
                      <span key={s} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600">
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-400">No skills added yet.</p>
                )}
              </div>

              <div className="mt-5 border-t border-ink-100 pt-5">
                <p className="label mb-2">CV / Resume</p>
                {user?.cv_url ? (
                  <a
                    href={fileUrl(user.cv_url) || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:underline"
                  >
                    📄 {user.cv_original_name || "Download CV"}
                  </a>
                ) : (
                  <p className="text-sm text-ink-400">No CV uploaded yet.</p>
                )}
                <button
                  type="button"
                  onClick={() => cvInputRef.current?.click()}
                  className="mt-2 block text-xs font-semibold text-ink-600 hover:text-ink-900"
                >
                  {uploadingCv ? "Uploading…" : user?.cv_url ? "Replace CV" : "Upload CV"}
                </button>
                <input
                  ref={cvInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleCvChange}
                />
              </div>

              <button onClick={() => setEditing(true)} className="btn-secondary mt-6 w-full">
                Edit profile
              </button>
            </>
          ) : (
            <form onSubmit={handleSave} className="mt-6 space-y-4 border-t border-ink-100 pt-5">
              {error && <div className="rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">{error}</div>}
              <div>
                <label className="label">Phone</label>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Birthday</label>
                <input
                  type="date"
                  className="input"
                  value={form.birthday}
                  onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Years of experience</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="input"
                  value={form.years_experience}
                  onChange={(e) => setForm({ ...form, years_experience: e.target.value })}
                />
              </div>
              <div>
                <label className="label">LinkedIn profile URL</label>
                <input
                  type="url"
                  placeholder="https://linkedin.com/in/..."
                  className="input"
                  value={form.linkedin_url}
                  onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Skills (comma separated)</label>
                <textarea
                  rows={2}
                  className="input resize-none"
                  placeholder="React, Project Management, SQL"
                  value={form.skillsText}
                  onChange={(e) => setForm({ ...form, skillsText: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="card text-center">
              <p className="font-display text-2xl font-bold text-ink-900">{daysPresent}</p>
              <p className="text-xs text-ink-400">Days present (this month)</p>
            </div>
            <div className="card text-center">
              <p className="font-display text-2xl font-bold text-ink-900">{approvedLeaves}</p>
              <p className="text-xs text-ink-400">Leaves approved</p>
            </div>
            <div className="card text-center">
              <p className="font-display text-2xl font-bold text-ink-900">{user?.annual_leave_balance}</p>
              <p className="text-xs text-ink-400">Annual leave remaining</p>
            </div>
          </div>

          <div className="card">
            <p className="mb-4 text-sm font-semibold text-ink-800">Recent leave records</p>
            {leaves.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-400">No leave records yet.</p>
            ) : (
              <ul className="space-y-3">
                {leaves.slice(0, 6).map((lv) => (
                  <li key={lv.id} className="flex items-center justify-between border-b border-ink-50 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium text-ink-800 capitalize">{lv.leave_type} leave</p>
                      <p className="text-xs text-ink-400">
                        {formatDate(lv.start_date)} – {formatDate(lv.end_date)} · {lv.days} day(s)
                      </p>
                    </div>
                    <StatusPill status={lv.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
