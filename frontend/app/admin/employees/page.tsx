"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { api, apiErrorMessage, fileUrl } from "@/lib/api";
import { UserOut, EmploymentType } from "@/lib/types";
import { formatDate, todayInKarachi } from "@/lib/format";

export default function AdminEmployeesPage() {
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
    phone: "",
    department: "",
    position: "",
    role: "employee" as "employee" | "admin",
    employment_type: "permanent" as EmploymentType,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

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
    setEditForm({
      name: emp.name,
      phone: emp.phone || "",
      department: emp.department,
      position: emp.position,
      role: emp.role,
      employment_type: emp.employment_type,
    });
  }

  async function handleEditSave() {
    if (editingId === null) return;
    setSavingEdit(true);
    setEditError("");
    try {
      await api.patch(`/employees/${editingId}`, editForm);
      setEditingId(null);
      await load();
    } catch (err) {
      setEditError(apiErrorMessage(err, "Could not save changes"));
    } finally {
      setSavingEdit(false);
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
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-ink-400">{employees.length} active employee(s)</p>
        <div className="flex gap-2">
          <button onClick={() => setShowExportPanel((s) => !s)} className="btn-secondary">
            ⬇ Export to Excel
          </button>
          <button onClick={() => setShowForm((s) => !s)} className="btn-primary">
            {showForm ? "Cancel" : "+ Add employee"}
          </button>
        </div>
      </div>

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
                  <th className="pb-3 pr-4">Manager</th>
                  <th className="pb-3 pr-4">Joined</th>
                  <th className="pb-3 pr-4">Annual balance</th>
                  <th className="pb-3 pr-4">Adjustment</th>
                  <th className="pb-3 pr-4">CNIC</th>
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
                      <p className="font-medium text-ink-800">{emp.annual_leave_balance}</p>
                      {!emp.is_eligible_for_annual_leave && (
                        <p className="text-[10px] text-ink-400">not yet eligible</p>
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
                    </td>
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
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={handleEditSave} disabled={savingEdit} className="btn-primary">
                    {savingEdit ? "Saving…" : "Save changes"}
                  </button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
