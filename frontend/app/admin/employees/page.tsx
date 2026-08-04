"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, apiErrorMessage } from "@/lib/api";
import { UserOut } from "@/lib/types";
import { formatDate } from "@/lib/format";

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<UserOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [quotaEdits, setQuotaEdits] = useState<Record<number, string>>({});

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    department: "",
    position: "",
    phone: "",
    leave_quota: "12",
    role: "employee" as "employee" | "admin",
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
      });
      setShowForm(false);
      setForm({
        name: "",
        email: "",
        password: "",
        department: "",
        position: "",
        phone: "",
        leave_quota: "12",
        role: "employee",
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

  async function handleExport() {
    setExporting(true);
    try {
      const res = await api.get("/reports/employees-excel", { responseType: "blob" });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const today = new Date().toISOString().slice(0, 10);
      link.download = `penaxis-hr-report-${today}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
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
          <button onClick={handleExport} disabled={exporting} className="btn-secondary">
            {exporting ? "Preparing…" : "⬇ Export to Excel"}
          </button>
          <button onClick={() => setShowForm((s) => !s)} className="btn-primary">
            {showForm ? "Cancel" : "+ Add employee"}
          </button>
        </div>
      </div>

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
              <label className="label">Leave quota (days)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                className="input"
                value={form.leave_quota}
                onChange={(e) => setForm({ ...form, leave_quota: e.target.value })}
              />
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
                  <th className="pb-3 pr-4">Department</th>
                  <th className="pb-3 pr-4">Joined</th>
                  <th className="pb-3 pr-4">Leave quota</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="border-b border-ink-50 last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-ink-800">{emp.name}</p>
                      <p className="text-xs text-ink-400">{emp.email}</p>
                    </td>
                    <td className="py-3 pr-4 capitalize text-ink-600">{emp.role}</td>
                    <td className="py-3 pr-4 text-ink-600">{emp.department}</td>
                    <td className="py-3 pr-4 text-ink-600">{formatDate(emp.join_date)}</td>
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
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleDelete(emp.id, emp.name)}
                        className="text-xs font-semibold text-danger hover:opacity-70"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
