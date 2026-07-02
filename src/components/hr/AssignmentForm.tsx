"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "@/components/ui";
import { AlertCircle } from "lucide-react";

type Project = { id: string; name: string; code: string };
type Employee = { id: string; empId: string; name: string };

export type AssignmentFormProps =
  | {
      mode: "byProject";
      employeeId: string;
      projects: Project[];
      /** Employee's current cross-project committed % (active assignments only). Advisory hint only. */
      committedPct?: number;
      /** 100 - committedPct, clamped to 0. Advisory hint only. */
      remainingPct?: number;
    }
  | {
      mode: "byEmployee";
      projectId: string;
      employees: Employee[];
    };

// Mode-derived copy — the two forms differ only in labels/copy, not behavior.
const COPY = {
  byProject: {
    heading: "Assign to Project",
    selectLabel: "Project",
    buttonIdle: "Assign",
    errorFallback: "Could not assign project",
    emptyMessage: null as string | null,
  },
  byEmployee: {
    heading: "Assign an Employee",
    selectLabel: "Employee",
    buttonIdle: "Assign employee",
    errorFallback: "Could not assign employee",
    emptyMessage: "All active employees are already assigned to this project.",
  },
} as const;

export default function AssignmentForm(props: AssignmentFormProps) {
  const router = useRouter();
  const options: { id: string }[] = props.mode === "byProject" ? props.projects : props.employees;
  const copy = COPY[props.mode];

  const [selectedId, setSelectedId] = useState(options[0]?.id ?? "");
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
      const employeeId = props.mode === "byProject" ? props.employeeId : selectedId;
      const projectId = props.mode === "byProject" ? selectedId : props.projectId;
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
      if (!res.ok) throw new Error(data.error || copy.errorFallback);
      setSelectedId(options[0]?.id ?? "");
      setRoleOnProject("");
      setAllocationPct("");
      setStartDate("");
      setEndDate("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorFallback);
    } finally {
      setBusy(false);
    }
  }

  if (options.length === 0) {
    if (!copy.emptyMessage) return null;
    return (
      <p className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400">
        {copy.emptyMessage}
      </p>
    );
  }

  // Soft client-side advisory only — the server aggregate check is authoritative.
  const committedPct = props.mode === "byProject" ? props.committedPct : undefined;
  const remainingPct = props.mode === "byProject" ? props.remainingPct : undefined;
  const enteredPct = allocationPct !== "" && Number.isFinite(Number(allocationPct)) ? Number(allocationPct) : null;
  const wouldOverAllocate =
    committedPct != null && enteredPct != null && committedPct + enteredPct > 100;

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{copy.heading}</p>
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={copy.selectLabel} required htmlFor="af-select">
          <Select id="af-select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {props.mode === "byProject"
              ? props.projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))
              : props.employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.empId} — {emp.name}</option>
                ))}
          </Select>
        </Field>
        <Field label="Role on Project" htmlFor="af-role">
          <Input id="af-role" type="text" value={roleOnProject} onChange={(e) => setRoleOnProject(e.target.value)} placeholder="e.g. Site Engineer" />
        </Field>
        <Field
          label="Allocation %"
          htmlFor="af-alloc"
          hint={
            committedPct != null && remainingPct != null
              ? `committed ${committedPct}% · remaining ${remainingPct}%`
              : undefined
          }
        >
          <Input
            id="af-alloc"
            type="number"
            min={0}
            max={100}
            value={allocationPct}
            onChange={(e) => setAllocationPct(e.target.value)}
            placeholder="0–100"
          />
        </Field>
        <Field label="Start Date" required htmlFor="af-start">
          <Input id="af-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </Field>
        <Field label="End Date" htmlFor="af-end">
          <Input id="af-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>
      {wouldOverAllocate && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            This would bring the employee to {committedPct! + enteredPct!}% committed across active projects —
            over 100%. The server will reject over-allocated assignments.
          </span>
        </p>
      )}
      <div>
        <Button type="submit" size="sm" disabled={busy}>{busy ? "Assigning…" : copy.buttonIdle}</Button>
      </div>
    </form>
  );
}
