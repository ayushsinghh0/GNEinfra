import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { fmtINR } from "@/lib/format";
import { PageHeader, Card, CardBody, EmptyState, EntityLink, StatusChip, btn } from "@/components/ui";
import { DataTable, type Column } from "@/components/DataTable";
import SavedViewPills from "@/components/hr/SavedViewPills";
import RecruitmentSearch from "@/components/hr/RecruitmentSearch";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["ACTIVE", "INACTIVE"]);

function monthlyNet(e: {
  salary: number | null; lta: number | null; specialAllowance: number | null; conveyance: number | null;
  pfDeduction: number | null; esiDeduction: number | null; tdsDeduction: number | null; otherDeduction: number | null;
}) {
  const gross = (e.salary ?? 0) + (e.lta ?? 0) + (e.specialAllowance ?? 0) + (e.conveyance ?? 0);
  const ded = (e.pfDeduction ?? 0) + (e.esiDeduction ?? 0) + (e.tdsDeduction ?? 0) + (e.otherDeduction ?? 0);
  return { gross, net: gross - ded };
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requirePageRole(HR_VIEW);
  const { q, status } = await searchParams;

  const where: Prisma.EmployeeWhereInput = {};
  if (status && VALID_STATUS.has(status)) where.status = status as Prisma.EmployeeWhereInput["status"];
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { empId: { contains: term, mode: "insensitive" } },
    ];
  }

  const employees = await prisma.employee.findMany({ where, orderBy: { name: "asc" } });
  const hasFilters = Boolean((q && q.trim()) || (status && VALID_STATUS.has(status)));

  type Emp = (typeof employees)[number];
  const columns: Column<Emp>[] = [
    {
      key: "emp",
      header: "Employee",
      titleInCard: true,
      cell: (e) => (
        <span className="relative z-10">
          <EntityLink href={`/hr/payroll/${e.id}`} name={e.name} code={e.empId} />
        </span>
      ),
    },
    { key: "designation", header: "Designation", priority: "md", cardLabel: "Designation", cell: (e) => e.designation ?? "—" },
    { key: "band", header: "Band", priority: "lg", cardLabel: "Band", cell: (e) => e.band ?? "—" },
    {
      key: "ctc",
      header: "CTC",
      align: "right",
      cardLabel: "CTC",
      cell: (e) => {
        const { gross } = monthlyNet(e);
        const mismatch = e.totalCtc != null && e.totalCtc > 0 && gross > 0 && gross * 12 !== e.totalCtc;
        return (
          <span className="inline-flex items-center gap-1.5">
            {mismatch && (
              <span
                title="12 × monthly gross does not equal Total CTC — fix the breakup on this employee's payroll page"
                className="whitespace-nowrap rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200"
              >
                breakup ≠ CTC
              </span>
            )}
            <span className="nums">{fmtINR(e.totalCtc)}</span>
          </span>
        );
      },
    },
    {
      key: "net",
      header: "Net / month",
      align: "right",
      cardLabel: "Net / month",
      cell: (e) => {
        const { net } = monthlyNet(e);
        return <span className="nums font-medium text-slate-700">{net > 0 ? fmtINR(net) : "—"}</span>;
      },
    },
    { key: "status", header: "Status", cardLabel: "Status", cell: (e) => <span className="relative z-10"><StatusChip status={e.status} /></span> },
  ];

  return (
    <>
      <PageHeader
        title="Payroll"
        subtitle={`${employees.length} employee(s) · CTC and pay structure`}
        breadcrumbs={[{ label: "HR", href: "/hr" }, { label: "Payroll" }]}
      />
      <div className="space-y-6 p-8">
        <Card>
          <CardBody className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
            <RecruitmentSearch basePath="/hr/payroll" placeholder="Search name or EMP ID…" />
            <SavedViewPills
              basePath="/hr/payroll"
              views={[
                { value: "", label: "All" },
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
              ]}
            />
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <DataTable
            rows={employees}
            columns={columns}
            rowKey={(e) => e.id}
            href={(e) => `/hr/payroll/${e.id}`}
            empty={
              <EmptyState
                icon={<Wallet className="h-6 w-6" />}
                title={hasFilters ? "No employees found" : "No employees yet"}
                description={hasFilters ? "Try a different search or status." : "Add employees first, then set their CTC here."}
                action={hasFilters ? <Link href="/hr/payroll" className={btn("secondary", "sm")}>Clear filters</Link> : undefined}
              />
            }
          />
        </Card>
      </div>
    </>
  );
}
