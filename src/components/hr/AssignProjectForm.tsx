"use client";
import AssignmentForm from "./AssignmentForm";

type Project = { id: string; name: string; code: string };

// Thin wrapper over the shared AssignmentForm — kept so existing imports
// (employees/[id]/(hub)/projects/page.tsx) don't need to change.
export default function AssignProjectForm({
  employeeId,
  projects,
  committedPct,
  remainingPct,
}: {
  employeeId: string;
  projects: Project[];
  committedPct?: number;
  remainingPct?: number;
}) {
  return (
    <AssignmentForm
      mode="byProject"
      employeeId={employeeId}
      projects={projects}
      committedPct={committedPct}
      remainingPct={remainingPct}
    />
  );
}
