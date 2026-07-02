import { Suspense } from "react";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { fmtDateOnly } from "@/lib/format";
import EmployeeSearch from "@/components/hr/EmployeeSearch";
import SavedViewPills from "@/components/hr/SavedViewPills";
import { DataTable, type Column } from "@/components/DataTable";
import {
  PageHeader,
  Card,
  CardBody,
  EmptyState,
  EntityLink,
  StatusChip,
  btn,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["ACTIVE", "INACTIVE"]);

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; category?: string; location?: string }>;
}) {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);

  const { q, status, category, location } = await searchParams;

  const where: Prisma.EmployeeWhereInput = {};
  if (status && VALID_STATUS.has(status)) {
    where.status = status as Prisma.EmployeeWhereInput["status"];
  }
  if (category && category.trim()) {
    where.empCategory = category.trim();
  }
  if (location && location.trim()) {
    where.location = location.trim();
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

  const filterNote = category ? `Category: ${category.trim()}` : location ? `Location: ${location.trim()}` : null;

  type Emp = (typeof employees)[number];
  const columns: Column<Emp>[] = [
    {
      key: "emp",
      header: "Employee",
      titleInCard: true,
      cell: (e) => (
        <span className="relative z-10">
          <EntityLink href={`/hr/employees/${e.id}`} name={e.name} code={e.empId} />
        </span>
      ),
    },
    {
      key: "designation",
      header: "Designation",
      cardLabel: "Designation",
      cell: (e) => e.designation ?? "—",
    },
    {
      key: "category",
      header: "Category",
      priority: "lg",
      cardLabel: "Category",
      cell: (e) => e.empCategory ?? "—",
    },
    {
      key: "location",
      header: "Location",
      priority: "lg",
      cardLabel: "Location",
      cell: (e) => e.location ?? "—",
    },
    {
      key: "doj",
      header: "DOJ",
      priority: "xl",
      cardLabel: "DOJ",
      cell: (e) => <span className="nums">{fmtDateOnly(e.dateOfJoining) ?? "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (e) => (
        <span className="relative z-10">
          <StatusChip status={e.status} />
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle={filterNote ? `${employees.length} result(s) · ${filterNote}` : `${employees.length} result(s)`}
        breadcrumbs={[{ label: "HR", href: "/hr" }, { label: "Employees" }]}
      >
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
          <CardBody className="space-y-3 p-4">
            {/* All/Active/Inactive saved-view pills — a quicker path to the same
                `?status=` param EmployeeSearch's dropdown drives; both compose via
                buildQuery so search/category/location scope is never dropped.
                On-leave/Exited presets aren't built — EmployeeStatus has no
                backing values for them without a schema migration (out of scope). */}
            <SavedViewPills
              basePath="/hr/employees"
              views={[
                { value: "", label: "All" },
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
              ]}
            />
            <Suspense fallback={<div className="h-10" />}>
              <EmployeeSearch />
            </Suspense>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <DataTable
            rows={employees}
            columns={columns}
            rowKey={(e) => e.id}
            href={(e) => `/hr/employees/${e.id}`}
            empty={
              <EmptyState
                icon={<Users className="h-6 w-6" />}
                title="No employees found"
                description="No employees match your search. Try a different term or status filter."
              />
            }
          />
        </Card>
      </div>
    </>
  );
}
