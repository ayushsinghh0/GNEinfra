"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "@/components/ui";
import { AlertCircle } from "lucide-react";

type Employee = { id: string; empId: string; name: string };

export default function AssignEmployeeForm({
  projectId,
  employees,
}: {
  projectId: string;
  employees: Employee[];
}) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [roleOnProject, setRoleOnProject] = useState("");
  const [allocationPct, setAllocationPct] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/hr/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          projectId,
          roleOnProject: roleOnProject || undefined,
          allocationPct: allocationPct !== "" ? Number(allocationPct) : undefined,
          startDate,
          endDate: endDate || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not assign employee");
      setEmployeeId(employees[0]?.id ?? "");
      setRoleOnProject("");
      setAllocationPct("");
      setStartDate("");
      setEndDate("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign employee");
    } finally {
      setBusy(false);
    }
  }

  if (employees.length === 0) {
    return (
      <p className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400">
        All active employees are already assigned to this project.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assign an Employee</p>
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Employee" required htmlFor="ae-emp">
          <Select id="ae-emp" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.empId} — {emp.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Role on Project" htmlFor="ae-role">
          <Input id="ae-role" type="text" value={roleOnProject} onChange={(e) => setRoleOnProject(e.target.value)} placeholder="e.g. Site Engineer" />
        </Field>
        <Field label="Allocation %" htmlFor="ae-alloc">
          <Input id="ae-alloc" type="number" min={0} max={100} value={allocationPct} onChange={(e) => setAllocationPct(e.target.value)} placeholder="0–100" />
        </Field>
        <Field label="Start Date" required htmlFor="ae-start">
          <Input id="ae-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </Field>
        <Field label="End Date" htmlFor="ae-end">
          <Input id="ae-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>
      <div>
        <Button type="submit" size="sm" disabled={busy}>{busy ? "Assigning…" : "Assign employee"}</Button>
      </div>
    </form>
  );
}
