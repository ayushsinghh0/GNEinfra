import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { PageHeader, btn } from "@/components/ui";
import EmployeeStatusAction from "@/components/hr/EmployeeStatusAction";
import ProfileHeader from "@/components/hr/ProfileHeader";
import SnapshotStrip from "@/components/hr/SnapshotStrip";
import EmployeeTabs from "@/components/hr/EmployeeTabs";
import { getEmployee } from "./_data";

export const dynamic = "force-dynamic";

// "Ny mo" tenure label from date of joining to today (UTC, so it doesn't
// shift with the server's local timezone).
function tenureLabel(doj: Date, ref = new Date()): string {
  let years = ref.getUTCFullYear() - doj.getUTCFullYear();
  let months = ref.getUTCMonth() - doj.getUTCMonth();
  if (ref.getUTCDate() < doj.getUTCDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years <= 0 && months <= 0) return "New";
  if (years <= 0) return `${months}mo`;
  return months > 0 ? `${years}y ${months}mo` : `${years}y`;
}

export default async function EmployeeHubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);

  const { id } = await params;
  const emp = await getEmployee(id);
  if (!emp) notFound();

  // UTC-midnight cutoff — MUST match hr-projects.ts's activeAllocation(),
  // which the Projects tab uses for "X% committed". endDate is stored at
  // UTC midnight; comparing against a full `new Date()` timestamp (today's
  // time-of-day) instead of a date-only cutoff made an assignment ending
  // "today" read as already-ended here but still-active there — the chip
  // undercounted by one, with the drift varying by server time-of-day.
  const today = new Date();
  const cutoff = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const activeProjects = emp.projectAssignments.filter((a) => !a.endDate || a.endDate.getTime() >= cutoff).length;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "HR", href: "/hr" },
          { label: "Employees", href: "/hr/employees" },
          { label: emp.name },
        ]}
        title={emp.name}
        subtitle={`${emp.empId} · ${emp.designation}`}
      >
        <Link href="/hr/employees" className={btn("secondary", "sm")}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        {canWrite && (
          <>
            {/* key={emp.id}: this layout persists across [id] navigations, so
                without a key EmployeeStatusAction's open/busy/date state
                could leak across employees (an in-flight status mutation
                resolving under a different employee's route). */}
            <EmployeeStatusAction key={emp.id} employeeId={emp.id} status={emp.status} />
            <Link href={`/hr/employees/${id}/edit`} className={btn("primary", "sm")}>
              Edit
            </Link>
          </>
        )}
      </PageHeader>

      <ProfileHeader
        name={emp.name}
        empId={emp.empId}
        designation={emp.designation}
        location={emp.location}
        empCategory={emp.empCategory}
        payrollType={emp.payrollType}
        dateOfJoining={emp.dateOfJoining}
        status={emp.status}
      />

      <SnapshotStrip
        id={id}
        tenureLabel={tenureLabel(emp.dateOfJoining)}
        assetsCount={emp.assets.length}
        activeProjects={activeProjects}
        band={emp.band}
      />

      <EmployeeTabs id={id} />

      <div className="p-6 sm:p-8">{children}</div>
    </>
  );
}
