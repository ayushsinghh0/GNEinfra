import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { fmtINR, fmtDateOnly } from "@/lib/format";
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Chip,
  btn,
  EmptyState,
} from "@/components/ui";
import { ArrowLeft, Laptop, CalendarDays, BadgeIndianRupee } from "lucide-react";
import { MONTHS } from "@/lib/hr-validation";

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
  const emp = await prisma.employee.findUnique({
    where: { id },
    include: {
      assets: true,
      payrolls: {
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
        take: 3,
      },
      attendance: {
        orderBy: { date: "desc" },
        take: 10,
      },
    },
  });
  if (!emp) notFound();

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

        {/* Recent payslips */}
        <Card>
          <CardHeader
            title="Recent Payslips"
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
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-slate-700">
                      {MONTHS[p.periodMonth - 1]} {p.periodYear}
                    </span>
                    <span className="nums text-slate-600">{fmtINR(p.payableAmount)}</span>
                  </div>
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
                        a.status === "PRESENT"
                          ? "bg-emerald-50 text-emerald-700"
                          : a.status === "ABSENT"
                          ? "bg-rose-50 text-rose-700"
                          : a.status === "LEAVE"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-600"
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
