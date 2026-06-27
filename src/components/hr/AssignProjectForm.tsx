"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "@/components/ui";
import { AlertCircle } from "lucide-react";

type Project = { id: string; name: string; code: string };

export default function AssignProjectForm({
  employeeId,
  projects,
}: {
  employeeId: string;
  projects: Project[];
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
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
      if (!res.ok) throw new Error(data.error || "Could not assign project");
      setProjectId(projects[0]?.id ?? "");
      setRoleOnProject("");
      setAllocationPct("");
      setStartDate("");
      setEndDate("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign project");
    } finally {
      setBusy(false);
    }
  }

  if (projects.length === 0) return null;

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assign to Project</p>
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Project" required htmlFor="ap-project">
          <Select id="ap-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </Select>
        </Field>
        <Field label="Role on Project" htmlFor="ap-role">
          <Input id="ap-role" type="text" value={roleOnProject} onChange={(e) => setRoleOnProject(e.target.value)} placeholder="e.g. Site Engineer" />
        </Field>
        <Field label="Allocation %" htmlFor="ap-alloc">
          <Input
            id="ap-alloc"
            type="number"
            min={0}
            max={100}
            value={allocationPct}
            onChange={(e) => setAllocationPct(e.target.value)}
            placeholder="0–100"
          />
        </Field>
        <Field label="Start Date" required htmlFor="ap-start">
          <Input id="ap-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </Field>
        <Field label="End Date" htmlFor="ap-end">
          <Input id="ap-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>
      <div>
        <Button type="submit" size="sm" disabled={busy}>{busy ? "Assigning…" : "Assign"}</Button>
      </div>
    </form>
  );
}
