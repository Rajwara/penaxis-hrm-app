"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { BirthdayBanner } from "@/components/BirthdayBanner";
import { useAuth } from "@/lib/auth-context";
import { api, apiErrorMessage, fileUrl } from "@/lib/api";
import { UserOut, EmploymentType } from "@/lib/types";
import { formatDate, todayInKarachi } from "@/lib/format";

export default function AdminEmployeesPage() {
  const { user: currentUser } = useAuth();
  const canManageCnic = !!(currentUser?.is_super_admin || currentUser?.can_view_cnic);
  const [employees, setEmployees] = useState<UserOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exportEmployeeId, setExportEmployeeId] = useState("");
  const [quotaEdits, setQuotaEdits] = useState<Record<number, string>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    position: "",
    role: "employee" as "employee" | "admin",
    employment_type: "permanent" as EmploymentType,
    internship_end_date_override: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResults, setBulkResults] = useState<
    { name: string; email: string; password: string | null; status: string; note: string }[]
  >([]);
  const [bulkError, setBulkError] = useState("");
  const [promoting, setPromoting] = useState<number | null>(null);
  const [togglingCnicAccess, setTogglingCnicAccess] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    department: "",
    position: "",
    phone: "",
    leave_quota: "0",
    role: "employee" as "employee" | "admin",
    manager_id: "",
    employment_type: "permanent" as EmploymentType,
    is_team_manager: false,
  });

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<UserOut[]>("/employees");
      setEmployees(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/employees", {
        ...form,
        leave_quota: Number(form.leave_quota),
        manager_id: form.manager_id ? Number(form.manager_id) : null,
      });
      setShowForm(false);
      setForm({
        name: "",
        email: "",
        password: "",
        department: "",
        position: "",
        phone: "",
        leave_quota: "0",
        role: "employee",
        manager_id: "",
        employment_type: "permanent",
        is_team_manager: false,
      });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not add employee"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Remove ${name} from the system? Their history will be preserved.`)) return;
    await api.delete(`/employees/${id}`);
    await load();
  }

  async function handleQuotaSave(id: number) {
    const value = quotaEdits[id];
    if (value === undefined) return;
    await api.patch(`/employees/${id}/leave-quota`, { leave_quota: Number(value) });
    setQuotaEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    await load();
  }

  async function handleManagerChange(id: number, managerId: string) {
    await api.patch(`/employees/${id}`, {
      manager_id: managerId ? Number(managerId) : null,
    });
    await load();
  }

  function handleEditOpen(emp: UserOut) {
    setEditingId(emp.id);
    setEditError("");
    setNewPassword("");
    setPasswordMessage("");
    setEditForm({
      name: emp.name,
      email: emp.email,
      phone: emp.phone || "",
      department: emp.department,
      position: emp.position,
      role: emp.role,
      employment_type: emp.employment_type,
      internship_end_date_override: emp.internship_end_date_override || "",
    });
  }

  async function handleBulkImport(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setBulkImporting(true);
    setBulkError("");
    setBulkResults([]);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/employees/bulk-import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setBulkResults(res.data.results);
      await load();
    } catch (err) {
      setBulkError(apiErrorMessage(err, "Could not import this file"));
    } finally {
      setBulkImporting(false);
      e.target.value = "";
    }
  }

  function copyBulkResultsAsText() {
    const lines = bulkResults
      .filter((r) => r.status === "created")
      .map((r) => `${r.name} — ${r.email} — ${r.password}`);
    navigator.clipboard.writeText(lines.join("\n"));
  }

  async function handlePromoteSuperAdmin(emp: UserOut) {
    if (
      !confirm(
        `Make ${emp.name} a super admin? They'll gain full access and become invisible to every other admin — no one else will be able to see, edit, or find them in the system. This should only be used for one trusted account.`
      )
    )
      return;
    setPromoting(emp.id);
    try {
      await api.post(`/employees/${emp.id}/promote-super-admin`);
      await load();
    } catch (err) {
      alert(apiErrorMessage(err, "Could not promote this account"));
    } finally {
      setPromoting(null);
    }
  }

  async function handleToggleCnicAccess(emp: UserOut) {
    const granting = !emp.can_view_cnic;
    if (
      granting &&
      !confirm(`Give ${emp.name} access to view, upload, and replace everyone's CNIC documents?`)
    )
      return;
    if (!granting && !confirm(`Remove ${emp.name}'s CNIC access?`)) return;
    setTogglingCnicAccess(emp.id);
    try {
      await api.post(`/employees/${emp.id}/${granting ? "grant-cnic-access" : "revoke-cnic-access"}`);
      await load();
    } catch (err) {
      alert(apiErrorMessage(err, "Could not update CNIC access"));
    } finally {
      setTogglingCnicAccess(null);
    }
  }

  async function handleEditSave() {
    if (editingId === null) return;
    setSavingEdit(true);
    setEditError("");
    try {
      await api.patch(`/employees/${editingId}`, {
        ...editForm,
        internship_end_date_override: editForm.internship_end_date_override || null,
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setEditError(apiErrorMessage(err, "Could not save changes"));
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleResetPassword() {
    if (editingId === null || newPassword.length < 6) return;
    setResettingPassword(true);
    setPasswordMessage("");
    try {
      await api.post(`/employees/${editingId}/reset-password`, { new_password: newPassword });
      setPasswordMessage("Password reset. Share the new password with them securely.");
      setNewPassword("");
    } catch (err) {
      setPasswordMessage(apiErrorMessage(err, "Could not reset password"));
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleAdminCnicReplace(id: number, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post(`/employees/${id}/cnic`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await load();
    } catch (err) {
      alert(apiErrorMessage(err, "Could not upload CNIC"));
    }
  }

  async function handleAdminCnicDelete(id: number, name: string) {
    if (!confirm(`Delete ${name}'s CNIC document? This cannot be undone.`)) return;
    try {
      await api.delete(`/employees/${id}/cnic`);
      await load();
    } catch (err) {
      alert(apiErrorMessage(err, "Could not delete CNIC"));
    }
  }

  async function handleManagerFlagToggle(id: number, value: boolean) {
    await api.patch(`/employees/${id}`, { is_team_manager: value });
    await load();
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params: Record<string, string> = {};
      if (exportFrom) params.start_date = exportFrom;
      if (exportTo) params.end_date = exportTo;
      if (exportEmployeeId) params.employee_id = exportEmployeeId;
      const res = await api.get("/reports/employees-excel", {
        params,
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const dateSuffix = exportFrom && exportTo ? `${exportFrom}_to_${exportTo}` : new Date().toISOString().slice(0, 10);
      const namedEmployee = employees.find((e) => String(e.id) === exportEmployeeId);
      const suffix = namedEmployee
        ? `${namedEmployee.name.toLowerCase().replace(/\s+/g, "-")}-${dateSuffix}`
        : dateSuffix;
      link.download = `penaxis-hr-report-${suffix}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setShowExportPanel(false);
    } catch {
      alert("Could not generate the report. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <AppShell title="Employees" subtitle="Add, remove, and manage your team" adminOnly>
      <BirthdayBanner />
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-ink-400">{employees.length} active employee(s)</p>
        <div className="flex gap-2">
          <button onClick={() => setShowBulkImport((s) => !s)} className="btn-secondary">
            ⬆ Bulk import
          </button>
          <button onClick={() => setShowExportPanel((s) => !s)} className="btn-secondary">
            ⬇ Export to Excel
          </button>
          <button onClick={() => setShowForm((s) => !s)} className="btn-primary">
            {showForm ? "Cancel" : "+ Add employee"}
          </button>
        </div>
      </div>

      {showBulkImport && (
        <div className="card mb-6">
          <p className="mb-2 text-sm font-semibold text-ink-800">Bulk import from spreadsheet</p>
          <p className="mb-3 text-xs text-ink-400">
            Upload an .xlsx roster with Name, Title, Joining Date, and Email columns. A random
            password is generated for each new account — save the list below immediately, since
            it's only shown this once.
          </p>
          <label className="btn-secondary inline-flex cursor-pointer">
            {bulkImporting ? "Importing…" : "Choose file"}
            <input type="file" accept=".xlsx" className="hidden" onChange={handleBulkImport} />
          </label>

          {bulkError && (
            <div className="mt-3 rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">{bulkError}</div>
          )}

          {bulkResults.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-ink-800">
                  {bulkResults.filter((r) => r.status === "created").length} account(s) created
                </p>
                <button onClick={copyBulkResultsAsText} className="text-xs font-semibold text-teal-600 hover:underline">
                  Copy list to share
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto rounded-lg border border-ink-100">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-ink-50">
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Password</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkResults.map((r, i) => (
                      <tr key={i} className="border-t border-ink-50">
                        <td className="px-3 py-2 text-ink-800">{r.name}</td>
                        <td className="px-3 py-2 text-ink-600">{r.email}</td>
                        <td className="px-3 py-2 font-mono text-ink-800">{r.password || "—"}</td>
                        <td className="px-3 py-2">
                          {r.status === "created" ? (
                            <span className="text-success">Created</span>
                          ) : (
                            <span className="text-ink-400">Skipped</span>
                          )}
                          {r.note && <p className="text-[11px] text-amber-600">{r.note}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {showExportPanel && (
        <div className="card mb-6 flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Employee (optional)</label>
            <select
              className="input"
              value={exportEmployeeId}
              onChange={(e) => setExportEmployeeId(e.target.value)}
            >
              <option value="">All employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">From (optional)</label>
            <input
              type="date"
              className="input"
              value={exportFrom}
              max={exportTo && exportTo < todayInKarachi() ? exportTo : todayInKarachi()}
              onChange={(e) => setExportFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="label">To (optional)</label>
            <input
              type="date"
              className="input"
              value={exportTo}
              min={exportFrom || undefined}
              max={todayInKarachi()}
              onChange={(e) => setExportTo(e.target.value)}
            />
          </div>
          <button onClick={handleExport} disabled={exporting} className="btn-primary">
            {exporting ? "Preparing…" : "Download report"}
          </button>
          <p className="w-full text-xs text-ink-400">
            Leave all fields blank to export everyone's full history. The date range and employee filter apply to attendance and leave records.
          </p>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="card mb-6 space-y-4">
          {error && <div className="rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">{error}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Full name</label>
              <input
                required
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                required
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Temporary password</label>
              <input
                required
                type="text"
                className="input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Role</label>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as "employee" | "admin" })}
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin / HR</option>
              </select>
            </div>
            <div>
              <label className="label">Department</label>
              <input
                className="input"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Position</label>
              <input
                className="input"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Leave adjustment (bonus days, optional)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                className="input"
                value={form.leave_quota}
                onChange={(e) => setForm({ ...form, leave_quota: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Employment type</label>
              <select
                className="input"
                value={form.employment_type}
                onChange={(e) => setForm({ ...form, employment_type: e.target.value as EmploymentType })}
              >
                <option value="permanent">Permanent</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern (3-month period)</option>
              </select>
            </div>
            <div>
              <label className="label">Reports to (manager)</label>
              <select
                className="input"
                value={form.manager_id}
                onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
              >
                <option value="">No manager</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="is_team_manager"
                className="h-4 w-4 rounded border-ink-100"
                checked={form.is_team_manager}
                onChange={(e) => setForm({ ...form, is_team_manager: e.target.checked })}
              />
              <label htmlFor="is_team_manager" className="text-sm text-ink-700">
                Also give this person manager access
                <span className="block text-xs text-ink-400">
                  e.g. a Senior Developer who also approves leave for their team
                </span>
              </label>
            </div>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Adding…" : "Add employee"}
          </button>
        </form>
      )}

      <div className="card">
        {loading ? (
          <p className="py-8 text-center text-sm text-ink-400">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4">Role</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Department</th>
                  <th className="pb-3 pr-4">Blood group</th>
                  <th className="pb-3 pr-4">Manager</th>
                  <th className="pb-3 pr-4">Joined</th>
                  <th className="pb-3 pr-4">Leave balance</th>
                  <th className="pb-3 pr-4">Adjustment</th>
                  {canManageCnic && <th className="pb-3 pr-4">CNIC</th>}
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="border-b border-ink-50 last:border-0">
                    <td className="py-3 pr-4">
                      <p className="flex items-center gap-1.5 font-medium text-ink-800">
                        {emp.name}
                        {emp.employment_type === "permanent" && <VerifiedBadge />}
                        {emp.is_manager && (
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600">
                            Manager
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-ink-400">{emp.email}</p>
                      <label className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-500">
                        <input
                          type="checkbox"
                          className="h-3 w-3 rounded border-ink-100"
                          checked={emp.is_team_manager}
                          onChange={(e) => handleManagerFlagToggle(emp.id, e.target.checked)}
                        />
                        Manager access
                      </label>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="capitalize text-ink-600">{emp.employment_type}</p>
                      {emp.employment_type === "intern" && emp.internship_end_date && (
                        <p className="text-[10px] text-ink-400">
                          {emp.is_internship_completed
                            ? emp.needs_internship_feedback
                              ? "Completed — awaiting feedback"
                              : "Completed"
                            : `Ends ${formatDate(emp.internship_end_date)}`}
                        </p>
                      )}
                      {emp.employment_type === "intern" && emp.intern_feedback && (
                        <button
                          onClick={() => alert(emp.intern_feedback || "")}
                          className="text-[10px] font-semibold text-brand-600 hover:underline"
                        >
                          View feedback
                        </button>
                      )}
                    </td>
                    <td className="py-3 pr-4 capitalize text-ink-600">{emp.role}</td>
                    <td className="py-3 pr-4 text-ink-600">{emp.department}</td>
                    <td className="py-3 pr-4 text-ink-600">{emp.blood_group || "—"}</td>
                    <td className="py-3 pr-4">
                      <select
                        className="input px-2 py-1.5 text-xs"
                        value={emp.manager_id ?? ""}
                        onChange={(e) => handleManagerChange(emp.id, e.target.value)}
                      >
                        <option value="">No manager</option>
                        {employees
                          .filter((m) => m.id !== emp.id)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="py-3 pr-4 text-ink-600">{formatDate(emp.join_date)}</td>
                    <td className="py-3 pr-4">
                      {emp.is_on_probation_leave_policy ? (
                        <>
                          <p className="font-medium text-ink-800">{emp.probation_leave_balance}</p>
                          <p className="text-[10px] text-ink-400">casual (probation), usable now</p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-ink-800">{emp.annual_leave_balance}</p>
                          {!emp.is_eligible_for_annual_leave && (
                            <p className="text-[10px] text-ink-400">not yet eligible</p>
                          )}
                        </>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          className="input w-20 px-2 py-1.5"
                          value={quotaEdits[emp.id] ?? String(emp.leave_quota)}
                          onChange={(e) =>
                            setQuotaEdits((prev) => ({ ...prev, [emp.id]: e.target.value }))
                          }
                        />
                        {quotaEdits[emp.id] !== undefined && (
                          <button
                            onClick={() => handleQuotaSave(emp.id)}
                            className="text-xs font-semibold text-teal-600 hover:text-teal-500"
                          >
                            Save
                          </button>
                        )}
                      </div>
                    </td>
                    {canManageCnic && (
                      <td className="py-3 pr-4">
                        {emp.cnic_url ? (
                          <a
                            href={fileUrl(emp.cnic_url) || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-teal-600 hover:underline"
                          >
                            Download
                          </a>
                        ) : (
                          <span className="text-xs text-ink-400">Not submitted</span>
                        )}
                        <label className="mt-1 block cursor-pointer text-[10px] font-semibold text-ink-500 hover:text-ink-800">
                          {emp.cnic_url ? "Replace" : "Upload"}
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.[0]) handleAdminCnicReplace(emp.id, e.target.files[0]);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {emp.cnic_url && (
                          <button
                            onClick={() => handleAdminCnicDelete(emp.id, emp.name)}
                            className="mt-1 block text-[10px] font-semibold text-danger hover:underline"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    )}
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => handleEditOpen(emp)}
                          className="text-xs font-semibold text-brand-600 hover:opacity-70"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(emp.id, emp.name)}
                          className="text-xs font-semibold text-danger hover:opacity-70"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {editingId !== null && (
              <div className="mt-4 border-t border-ink-100 pt-4">
                <p className="mb-3 text-sm font-semibold text-ink-800">
                  Editing {employees.find((e) => e.id === editingId)?.name}
                </p>
                {editError && (
                  <div className="mb-3 rounded-lg bg-danger/10 px-3 py-2.5 text-sm text-danger">{editError}</div>
                )}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="label">Name</label>
                    <input
                      className="input"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input
                      type="email"
                      className="input"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input
                      className="input"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Department</label>
                    <input
                      className="input"
                      value={editForm.department}
                      onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Position</label>
                    <input
                      className="input"
                      value={editForm.position}
                      onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Role</label>
                    <select
                      className="input"
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value as "employee" | "admin" })}
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Admin / HR</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Employment type</label>
                    <select
                      className="input"
                      value={editForm.employment_type}
                      onChange={(e) => setEditForm({ ...editForm, employment_type: e.target.value as EmploymentType })}
                    >
                      <option value="permanent">Permanent</option>
                      <option value="contract">Contract</option>
                      <option value="intern">Intern (3-month period)</option>
                    </select>
                  </div>
                  {editForm.employment_type === "intern" && (
                    <div>
                      <label className="label">Internship end date (override)</label>
                      <input
                        type="date"
                        className="input"
                        value={editForm.internship_end_date_override}
                        onChange={(e) =>
                          setEditForm({ ...editForm, internship_end_date_override: e.target.value })
                        }
                      />
                      <p className="mt-1 text-xs text-ink-400">
                        Leave blank to use the standard 3 months from join date. Set this for early
                        exits or extensions — the completion notification uses this date instead.
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={handleEditSave} disabled={savingEdit} className="btn-primary">
                    {savingEdit ? "Saving…" : "Save changes"}
                  </button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary">
                    Cancel
                  </button>
                </div>

                <div className="mt-5 border-t border-ink-100 pt-4">
                  <p className="label mb-2">Reset password</p>
                  <p className="mb-2 text-xs text-ink-400">
                    If they've forgotten their password, set a new temporary one here and share it with them directly.
                  </p>
                  {passwordMessage && (
                    <p className="mb-2 text-sm text-ink-700">{passwordMessage}</p>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input"
                      placeholder="New password (min 6 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button
                      onClick={handleResetPassword}
                      disabled={resettingPassword || newPassword.length < 6}
                      className="btn-secondary whitespace-nowrap"
                    >
                      {resettingPassword ? "Resetting…" : "Reset password"}
                    </button>
                  </div>
                </div>

                {currentUser?.is_super_admin && (
                  <div className="mt-5 border-t border-danger/20 pt-4">
                    <p className="label mb-2 text-danger">Super admin access</p>
                    <p className="mb-2 text-xs text-ink-400">
                      Grants full access and makes this account invisible to every other admin —
                      hidden from the employee list, exports, and everyone else's edit/delete/reset
                      actions. Only you can grant or revoke this, on anyone's account.
                    </p>
                    <button
                      onClick={() => {
                        const emp = employees.find((e) => e.id === editingId);
                        if (emp) handlePromoteSuperAdmin(emp);
                      }}
                      disabled={promoting === editingId}
                      className="btn-secondary border-danger/30 text-danger"
                    >
                      {promoting === editingId ? "Promoting…" : "Make super admin"}
                    </button>
                  </div>
                )}

                {currentUser?.is_super_admin && (
                  <div className="mt-5 border-t border-ink-100 pt-4">
                    <p className="label mb-2">CNIC access</p>
                    <p className="mb-2 text-xs text-ink-400">
                      By default only you can view, upload, or replace anyone's CNIC. Grant this
                      specifically if someone else needs it — regular HR/Admin and employees won't
                      see the CNIC column at all unless granted here.
                    </p>
                    {(() => {
                      const emp = employees.find((e) => e.id === editingId);
                      if (!emp) return null;
                      return (
                        <button
                          onClick={() => handleToggleCnicAccess(emp)}
                          disabled={togglingCnicAccess === editingId}
                          className={
                            emp.can_view_cnic
                              ? "btn-secondary border-danger/30 text-danger"
                              : "btn-secondary"
                          }
                        >
                          {togglingCnicAccess === editingId
                            ? "Updating…"
                            : emp.can_view_cnic
                            ? "Revoke CNIC access"
                            : "Grant CNIC access"}
                        </button>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
