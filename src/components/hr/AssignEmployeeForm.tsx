"use client";
import AssignmentForm from "./AssignmentForm";

type Employee = { id: string; empId: string; name: string };

// Thin wrapper over the shared AssignmentForm — kept so existing imports
// (projects/[id]/page.tsx) don't need to change.
export default function AssignEmployeeForm({
  projectId,
  employees,
}: {
  projectId: string;
  employees: Employee[];
}) {
  return <AssignmentForm mode="byEmployee" projectId={projectId} employees={employees} />;
}
