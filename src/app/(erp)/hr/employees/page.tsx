import { Suspense } from "react";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { fmtDateOnly } from "@/lib/format";
import EmployeeSearch from "@/components/hr/EmployeeSearch";
import {
  PageHeader,
  Card,
  CardBody,
  EmptyState,
  Chip,
  thCls,
  theadRowCls,
  tdCls,
  trCls,
  btn,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["ACTIVE", "INACTIVE"]);

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);

  const { q, status } = await searchParams;

  const where: Prisma.EmployeeWhereInput = {};
  if (status && VALID_STATUS.has(status)) {
    where.status = status as Prisma.EmployeeWhereInput["status"];
  }
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { empId: { contains: term, mode: "insensitive" } },
      { designation: { contains: term, mode: "insensitive" } },
      { mailId: { contains: term, mode: "insensitive" } },
    ];
  }

  const employees = await prisma.employee.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader title="Employees" subtitle={`${employees.length} result(s)`}>
        <a
          href="/api/hr/employees/export"
          className={btn("ghost", "sm")}
          download
        >
          Export XLSX
        </a>
        {canWrite && (
          <Link href="/hr/employees/new" className={btn("primary", "sm")}>
            + Add employee
          </Link>
        )}
      </PageHeader>

      <div className="p-8 space-y-6">
        <Card>
          <CardBody className="p-4">
            <Suspense fallback={<div className="h-10" />}>
              <EmployeeSearch />
            </Suspense>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          {employees.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No employees found"
              description="No employees match your search. Try a different term or status filter."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[12%]" />
                  <col className="w-[20%]" />
                  <col className="w-[18%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead>
                  <tr className={theadRowCls}>
                    <th className={thCls}>EMP ID</th>
                    <th className={thCls}>Name</th>
                    <th className={thCls}>Designation</th>
                    <th className={thCls}>Category</th>
                    <th className={thCls}>Location</th>
                    <th className={thCls}>DOJ</th>
                    <th className={thCls}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id} className={trCls}>
                      <td className={tdCls}>
                        <span className="nums font-mono text-xs text-slate-600">{emp.empId}</span>
                      </td>
                      <td className={tdCls}>
                        <Link
                          href={`/hr/employees/${emp.id}`}
                          className="font-medium text-brand-700 hover:text-brand-900 hover:underline"
                        >
                          {emp.name}
                        </Link>
                      </td>
                      <td className={tdCls}>{emp.designation}</td>
                      <td className={tdCls}>{emp.empCategory ?? "—"}</td>
                      <td className={tdCls}>{emp.location ?? "—"}</td>
                      <td className={tdCls}>
                        <span className="nums">{fmtDateOnly(emp.dateOfJoining) ?? "—"}</span>
                      </td>
                      <td className={tdCls}>
                        <Chip
                          className={
                            emp.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }
                        >
                          {emp.status}
                        </Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
