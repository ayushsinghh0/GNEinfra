import { Suspense } from "react";
import { Prisma } from "@prisma/client";
import { Package, Laptop, RotateCcw, UserX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { fmtDateOnly } from "@/lib/format";
import AssetRowActions from "@/components/hr/AssetRowActions";
import AddAssetButton from "@/components/hr/AddAssetButton";
import AssetSearch from "@/components/hr/AssetSearch";
import ScopedFilterChip from "@/components/hr/ScopedFilterChip";
import AssetStatusFilter from "@/components/hr/AssetStatusFilter";
import { DataTable, type Column } from "@/components/DataTable";
import {
  PageHeader,
  Card,
  CardBody,
  EmptyState,
  EntityLink,
  StatusChip,
  StatCard,
  Chip,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["ALLOCATED", "RETURNED"]);

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; status?: string; q?: string }>;
}) {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);

  const { employeeId: rawEmployeeId, status: rawStatus, q: rawQ } = await searchParams;
  const employeeId = rawEmployeeId?.trim() || undefined;
  const statusFilter = rawStatus && VALID_STATUS.has(rawStatus) ? rawStatus : "";
  const q = rawQ?.trim() || undefined;

  const assetWhere: Prisma.EmployeeAssetWhereInput = {};
  if (employeeId) assetWhere.employeeId = employeeId;
  if (q) {
    // Free-text search across serial/make-model/OEM and the owning
    // employee's name — server-side WHERE, consistent with how the
    // employees list builds its `q` filter (employees/page.tsx).
    assetWhere.OR = [
      { lpSerialNo: { contains: q, mode: "insensitive" } },
      { makeModel: { contains: q, mode: "insensitive" } },
      { oemName: { contains: q, mode: "insensitive" } },
      { employee: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [assets, employees, scopedEmployee, noAssetEmployees] = await Promise.all([
    prisma.employeeAsset.findMany({
      where: assetWhere,
      include: { employee: { select: { id: true, empId: true, name: true } } },
      orderBy: { allocatedAt: "desc" },
    }),
    canWrite
      ? prisma.employee.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, empId: true, name: true, designation: true, mailId: true, location: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    employeeId
      ? prisma.employee.findUnique({ where: { id: employeeId }, select: { name: true, empId: true } })
      : Promise.resolve(null),
    prisma.employee.count({ where: { status: "ACTIVE", assets: { none: {} } } }),
  ]);

  // KPIs reflect the employeeId scope (if any) but NOT the status filter below,
  // so the strip stays a stable "totals" reference while the table is sliced.
  const allocatedCount = assets.filter((a) => !a.returnedAt).length;
  const returnedCount = assets.length - allocatedCount;

  const filteredAssets = statusFilter
    ? assets.filter((a) => (statusFilter === "ALLOCATED" ? !a.returnedAt : !!a.returnedAt))
    : assets;

  // Any filter/scope active — distinguishes "no matches for this search" from
  // a genuinely empty register in the EmptyState copy below.
  const hasFilters = Boolean(q || statusFilter || employeeId);

  type AssetRow = (typeof assets)[number];
  const columns: Column<AssetRow>[] = [
    {
      key: "employee",
      header: "Employee",
      titleInCard: true,
      cell: (a) => (
        <span className="relative z-10">
          <EntityLink href={`/hr/employees/${a.employee.id}`} name={a.employee.name} code={a.employee.empId} />
        </span>
      ),
    },
    {
      key: "items",
      header: "Items issued",
      cardLabel: "Items",
      cell: (a) => {
        const issued = [
          a.hasLaptop && "Laptop",
          a.laptopBag && "Bag",
          a.mouse && "Mouse",
          a.charger && "Charger",
          a.idCard && "ID Card",
        ].filter((x): x is string => Boolean(x));
        if (issued.length === 0) return <span className="text-slate-400">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {issued.map((it) => (
              <Chip key={it}>{it}</Chip>
            ))}
          </div>
        );
      },
    },
    {
      key: "serial",
      header: "Serial / Make",
      priority: "lg",
      cardLabel: "Serial",
      cell: (a) => (
        <span className="block min-w-0">
          <span className="nums block truncate font-mono text-xs text-slate-600">{a.lpSerialNo || "—"}</span>
          {a.makeModel && <span className="block truncate text-xs text-slate-500">{a.makeModel}</span>}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cardLabel: "Status",
      cell: (a) => (
        <span className="relative z-10">
          <StatusChip status={a.returnedAt ? "RETURNED" : "ALLOCATED"} />
        </span>
      ),
    },
    {
      key: "allocated",
      header: "Allocated",
      priority: "lg",
      cardLabel: "Allocated",
      cell: (a) => <span className="nums">{fmtDateOnly(a.allocatedAt) ?? "—"}</span>,
    },
  ];

  if (canWrite) {
    columns.push({
      key: "actions",
      header: "Actions",
      cardLabel: "Actions",
      cell: (a) => (
        <span className="relative z-10">
          <AssetRowActions
            asset={{
              id: a.id,
              employeeId: a.employee.id,
              hasLaptop: a.hasLaptop,
              laptopBag: a.laptopBag,
              mouse: a.mouse,
              charger: a.charger,
              idCard: a.idCard,
              lpSerialNo: a.lpSerialNo ?? "",
              makeModel: a.makeModel ?? "",
              lpCategory: a.lpCategory ?? "",
              oemName: a.oemName ?? "",
              returnedAt: a.returnedAt ? a.returnedAt.toISOString().slice(0, 10) : "",
            }}
            employees={employees}
          />
        </span>
      ),
    });
  }

  return (
    <>
      <PageHeader
        title="Asset Register"
        subtitle={`${assets.length} record(s)`}
        breadcrumbs={[{ label: "HR", href: "/hr" }, { label: "Assets" }]}
      >
        {canWrite && <AddAssetButton employees={employees} />}
      </PageHeader>

      <div className="p-8 space-y-6">
        {scopedEmployee && (
          <ScopedFilterChip
            name={scopedEmployee.name}
            empId={scopedEmployee.empId}
            employeeHref={`/hr/employees/${employeeId}`}
            clearHref="/hr/assets"
          />
        )}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total assets" value={assets.length} tone="brand" icon={<Package className="h-4 w-4" />} />
          <StatCard label="Allocated" value={allocatedCount} tone="blue" icon={<Laptop className="h-4 w-4" />} />
          <StatCard label="Returned" value={returnedCount} tone="slate" icon={<RotateCcw className="h-4 w-4" />} />
          <StatCard
            label="Employees with no asset"
            value={noAssetEmployees}
            tone="amber"
            icon={<UserX className="h-4 w-4" />}
            href="/hr/employees"
          />
        </div>

        <Card>
          <CardBody className="space-y-3 p-4">
            <AssetStatusFilter counts={{ all: assets.length, ALLOCATED: allocatedCount, RETURNED: returnedCount }} />
            <Suspense fallback={<div className="h-10" />}>
              <AssetSearch />
            </Suspense>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <DataTable
            rows={filteredAssets}
            columns={columns}
            rowKey={(a) => a.id}
            empty={
              <EmptyState
                icon={<Package className="h-6 w-6" />}
                title={hasFilters ? "No assets match this filter" : "No asset records found"}
                description={
                  hasFilters
                    ? "Try a different search term or status filter."
                    : "Once assets are allocated to employees, they will appear here."
                }
              />
            }
          />
        </Card>
      </div>
    </>
  );
}
