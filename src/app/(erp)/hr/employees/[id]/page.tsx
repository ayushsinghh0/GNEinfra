import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { fmtINR, fmtDateOnly } from "@/lib/format";
import { leaveBalances, attendanceYearSummary } from "@/lib/hr-leave";
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Chip,
  btn,
  EmptyState,
} from "@/components/ui";
import { ArrowLeft, Laptop, CalendarDays, BadgeIndianRupee, FolderKanban } from "lucide-react";
import { MONTHS } from "@/lib/hr-validation";
import AssignProjectForm from "@/components/hr/AssignProjectForm";
import RemoveAssignmentButton from "@/components/hr/RemoveAssignmentButton";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
      <span className="w-44 shrink-0 text-[13px] font-medium text-slate-500">{label}</span>
      <span className="text-sm text-slate-800">{value ?? "—"}</span>
    </div>
  );
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);

  const { id } = await params;

  const [emp, projects] = await Promise.all([
    prisma.employee.findUnique({
      where: { id },
      include: {
        assets: true,
        payrolls: {
          orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
        },
        attendance: {
          orderBy: { date: "desc" },
          take: 10,
        },
        projectAssignments: {
          include: { project: true },
          orderBy: { startDate: "desc" },
        },
      },
    }),
    prisma.project.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!emp) notFound();

  const year = new Date().getUTCFullYear();
  const [balances, summary] = await Promise.all([
    leaveBalances(emp.id, year, emp.casualLeaveQuota, emp.sickLeaveQuota),
    attendanceYearSummary(emp.id, year),
  ]);

  const statusChipColors: Record<string, string> = {
    PRESENT: "bg-emerald-50 text-emerald-700",
    ABSENT: "bg-rose-50 text-rose-700",
    LEAVE: "bg-amber-50 text-amber-700",
    SICK: "bg-violet-50 text-violet-700",
    HALF_DAY: "bg-sky-50 text-sky-700",
    HOLIDAY: "bg-teal-50 text-teal-700",
    WEEK_OFF: "bg-slate-100 text-slate-600",
  };

  return (
    <>
      <PageHeader title={emp.name} subtitle={`${emp.empId} · ${emp.designation}`}>
        <Link href="/hr/employees" className={btn("secondary", "sm")}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        {canWrite && (
          <Link href={`/hr/employees/${id}/edit`} className={btn("primary", "sm")}>
            Edit
          </Link>
        )}
      </PageHeader>

      <div className="p-8 space-y-6">
        {/* Core details */}
        <Card>
          <CardHeader
            title="Employee Details"
            action={
              <Chip
                className={
                  emp.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }
              >
                {emp.status}
              </Chip>
            }
          />
          <CardBody>
            <div className="divide-y divide-slate-100">
              <Row label="EMP ID" value={<span className="nums font-mono text-xs">{emp.empId}</span>} />
              <Row label="Name" value={emp.name} />
              <Row label="Designation" value={emp.designation} />
              <Row label="Category" value={emp.empCategory} />
              <Row label="Location" value={emp.location} />
              <Row label="Payroll Type" value={emp.payrollType} />
              <Row label="Mail ID" value={emp.mailId} />
              <Row label="Emergency Number" value={emp.emergencyNumber} />
              <Row label="Blood Group" value={emp.bloodGroup} />
              <Row label="I-Card No" value={emp.iCardNo} />
              <Row label="Date of Birth" value={fmtDateOnly(emp.dob)} />
              <Row label="Date of Joining" value={fmtDateOnly(emp.dateOfJoining)} />
              <Row label="Offer Letter Date" value={fmtDateOnly(emp.offerLetterDate)} />
              <Row label="Leaving Date" value={fmtDateOnly(emp.leavingDate)} />
              <Row label="Bank A/C No" value={emp.bankAccountNo} />
              <Row label="Bank Name" value={emp.bankName} />
              <Row label="IFSC" value={emp.ifsc} />
              <Row label="PAN" value={emp.panNo} />
              <Row label="UAN" value={emp.uan} />
              <Row label="ESIC No" value={emp.esicNo} />
            </div>
          </CardBody>
        </Card>

        {/* Compensation */}
        <Card>
          <CardHeader title="Compensation" />
          <CardBody>
            <div className="divide-y divide-slate-100">
              <Row label="Total CTC" value={fmtINR(emp.totalCtc)} />
              <Row label="Salary" value={fmtINR(emp.salary)} />
              <Row label="LTA" value={fmtINR(emp.lta)} />
              <Row label="Special Allowance" value={fmtINR(emp.specialAllowance)} />
              <Row label="Conveyance" value={fmtINR(emp.conveyance)} />
            </div>
          </CardBody>
        </Card>

        {/* Assets */}
        <Card>
          <CardHeader
            title="Assets"
            action={<Laptop className="h-4 w-4 text-slate-400" />}
          />
          {emp.assets.length === 0 ? (
            <EmptyState
              icon={<Laptop className="h-5 w-5" />}
              title="No assets assigned"
              description="No assets have been recorded for this employee."
            />
          ) : (
            <CardBody>
              {emp.assets.map((a) => (
                <div key={a.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
                    <Row label="Laptop" value={a.hasLaptop ? "Yes" : "No"} />
                    {a.lpSerialNo && <Row label="Serial No" value={a.lpSerialNo} />}
                    {a.makeModel && <Row label="Make / Model" value={a.makeModel} />}
                    {a.lpCategory && <Row label="Category" value={a.lpCategory} />}
                    {a.oemName && <Row label="OEM" value={a.oemName} />}
                    <Row label="Bag" value={a.laptopBag ? "Yes" : "No"} />
                    <Row label="Mouse" value={a.mouse ? "Yes" : "No"} />
                    <Row label="Charger" value={a.charger ? "Yes" : "No"} />
                    <Row label="ID Card" value={a.idCard ? "Yes" : "No"} />
                    {a.allocatedAt && <Row label="Allocated" value={fmtDateOnly(a.allocatedAt)} />}
                    {a.returnedAt && <Row label="Returned" value={fmtDateOnly(a.returnedAt)} />}
                  </div>
                </div>
              ))}
            </CardBody>
          )}
        </Card>

        {/* Project Assignments */}
        <Card>
          <CardHeader
            title="Projects"
            action={<FolderKanban className="h-4 w-4 text-slate-400" />}
          />
          {emp.projectAssignments.length === 0 && !canWrite ? (
            <EmptyState
              icon={<FolderKanban className="h-5 w-5" />}
              title="No project assignments"
              description="This employee has not been assigned to any projects."
            />
          ) : (
            <CardBody>
              {emp.projectAssignments.length > 0 && (
                <div className="space-y-2 mb-4">
                  {emp.projectAssignments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                        <span className="font-medium text-slate-800 truncate">{a.project.name}</span>
                        <span className="nums text-xs text-slate-500 font-mono">{a.project.code}</span>
                        {a.roleOnProject && (
                          <span className="text-slate-600">{a.roleOnProject}</span>
                        )}
                        {a.allocationPct != null && (
                          <span className="nums text-slate-500">{a.allocationPct}%</span>
                        )}
                        <span className="text-slate-400 text-xs">
                          {fmtDateOnly(a.startDate)} – {a.endDate ? fmtDateOnly(a.endDate) : "Ongoing"}
                        </span>
                      </div>
                      {canWrite && <RemoveAssignmentButton assignmentId={a.id} />}
                    </div>
                  ))}
                </div>
              )}
              {emp.projectAssignments.length === 0 && (
                <p className="text-sm text-slate-400 mb-4">No project assignments yet.</p>
              )}
              {canWrite && <AssignProjectForm employeeId={emp.id} projects={projects} />}
            </CardBody>
          )}
        </Card>

        {/* Attendance Summary & Leave Balances */}
        <Card>
          <CardHeader
            title="Attendance Summary & Leave Balances"
            action={<CalendarDays className="h-4 w-4 text-slate-400" />}
          />
          <CardBody>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{year} Summary</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {(
                [
                  ["Present", "PRESENT", "bg-emerald-50 text-emerald-700"],
                  ["Absent", "ABSENT", "bg-rose-50 text-rose-700"],
                  ["Leave", "LEAVE", "bg-amber-50 text-amber-700"],
                  ["Sick", "SICK", "bg-violet-50 text-violet-700"],
                  ["Half-day", "HALF_DAY", "bg-sky-50 text-sky-700"],
                  ["Holiday", "HOLIDAY", "bg-teal-50 text-teal-700"],
                  ["Week-off", "WEEK_OFF", "bg-slate-100 text-slate-600"],
                ] as const
              ).map(([label, key, cls]) => (
                <div key={key} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${cls}`}>
                  <span className="nums font-semibold">{summary[key]}</span>
                  <span className="text-xs">{label}</span>
                </div>
              ))}
            </div>

            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Leave Balances</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500 mb-2">Casual Leave</p>
                <div className="flex items-end gap-1.5">
                  <span className="nums text-2xl font-bold text-slate-800">{balances.casualRemaining}</span>
                  <span className="text-sm text-slate-400 pb-0.5">remaining</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 nums">
                  {balances.casualTaken} taken · {balances.casualQuota} quota
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500 mb-2">Sick Leave</p>
                <div className="flex items-end gap-1.5">
                  <span className="nums text-2xl font-bold text-slate-800">{balances.sickRemaining}</span>
                  <span className="text-sm text-slate-400 pb-0.5">remaining</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 nums">
                  {balances.sickTaken} taken · {balances.sickQuota} quota
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Payslips */}
        <Card>
          <CardHeader
            title="Payslips"
            action={<BadgeIndianRupee className="h-4 w-4 text-slate-400" />}
          />
          {emp.payrolls.length === 0 ? (
            <EmptyState
              icon={<BadgeIndianRupee className="h-5 w-5" />}
              title="No payslips yet"
              description="No payroll records have been processed for this employee."
            />
          ) : (
            <CardBody>
              <div className="space-y-2">
                {emp.payrolls.map((p) => (
                  <Link
                    key={p.id}
                    href={`/hr/payout/${p.id}/print`}
                    className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 text-sm hover:bg-slate-50 transition-colors group"
                  >
                    <span className="font-medium text-slate-700 group-hover:text-brand-700">
                      {MONTHS[p.periodMonth - 1]} {p.periodYear}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="nums text-slate-600">{fmtINR(p.payableAmount)}</span>
                      <span className="text-xs text-brand-600 font-medium group-hover:underline">Slip →</span>
                    </div>
                  </Link>
                ))}
              </div>
            </CardBody>
          )}
        </Card>

        {/* Recent attendance */}
        <Card>
          <CardHeader
            title="Recent Attendance"
            action={<CalendarDays className="h-4 w-4 text-slate-400" />}
          />
          {emp.attendance.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-5 w-5" />}
              title="No attendance records"
              description="No attendance has been recorded for this employee."
            />
          ) : (
            <CardBody>
              <div className="space-y-1.5">
                {emp.attendance.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm odd:bg-slate-50"
                  >
                    <span className="nums text-slate-600">{fmtDateOnly(a.date)}</span>
                    <Chip
                      className={
                        statusChipColors[a.status] ?? "bg-slate-100 text-slate-600"
                      }
                    >
                      {a.status.replace(/_/g, " ")}
                    </Chip>
                  </div>
                ))}
              </div>
            </CardBody>
          )}
        </Card>
      </div>
    </>
  );
}
