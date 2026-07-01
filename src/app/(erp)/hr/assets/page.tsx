import { Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { fmtDate } from "@/lib/format";
import AssetForm from "@/components/hr/AssetForm";
import AssetRowActions from "@/components/hr/AssetRowActions";
import ScopedFilterChip from "@/components/hr/ScopedFilterChip";
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  EmptyState,
  thCls,
  theadRowCls,
  tdCls,
  trCls,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>;
}) {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);

  const { employeeId: rawEmployeeId } = await searchParams;
  const employeeId = rawEmployeeId?.trim() || undefined;

  const [assets, employees, scopedEmployee] = await Promise.all([
    prisma.employeeAsset.findMany({
      where: employeeId ? { employeeId } : undefined,
      include: { employee: { select: { id: true, empId: true, name: true, designation: true, mailId: true, location: true } } },
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
  ]);

  return (
    <>
      <PageHeader title="Asset Register" subtitle={`${assets.length} record(s)`} />

      <div className="p-8 space-y-6">
        {scopedEmployee && (
          <ScopedFilterChip
            name={scopedEmployee.name}
            empId={scopedEmployee.empId}
            employeeHref={`/hr/employees/${employeeId}`}
            clearHref="/hr/assets"
          />
        )}
        {canWrite && (
          <Card>
            <CardHeader title="Add asset record" />
            <CardBody>
              <AssetForm employees={employees} />
            </CardBody>
          </Card>
        )}

        <Card className="overflow-hidden">
          {assets.length === 0 ? (
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title="No asset records found"
              description="Once assets are allocated to employees, they will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1400px] text-sm">
                <thead>
                  <tr className={theadRowCls}>
                    <th className={thCls}>Employee</th>
                    <th className={thCls}>Position</th>
                    <th className={thCls}>Mail ID</th>
                    <th className={thCls}>Location</th>
                    <th className={thCls}>Laptop</th>
                    <th className={thCls}>Serial No</th>
                    <th className={thCls}>Make / Model</th>
                    <th className={thCls}>Bag</th>
                    <th className={thCls}>Mouse</th>
                    <th className={thCls}>Charger</th>
                    <th className={thCls}>ID Card</th>
                    <th className={thCls}>OEM</th>
                    <th className={thCls}>Allocated</th>
                    <th className={thCls}>Returned</th>
                    {canWrite && <th className={thCls}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.id} className={trCls}>
                      <td className={tdCls}>
                        <span className="nums font-mono text-xs text-slate-500">{a.employee.empId}</span>
                        {" · "}
                        <span className="font-medium text-slate-800">{a.employee.name}</span>
                      </td>
                      <td className={tdCls}>{a.employee.designation ?? "—"}</td>
                      <td className={tdCls}>{a.employee.mailId ?? "—"}</td>
                      <td className={tdCls}>{a.employee.location ?? "—"}</td>
                      <td className={tdCls}>{a.hasLaptop ? "✓" : "—"}</td>
                      <td className={tdCls}>{a.lpSerialNo ?? "—"}</td>
                      <td className={tdCls}>{a.makeModel ?? "—"}</td>
                      <td className={tdCls}>{a.laptopBag ? "✓" : "—"}</td>
                      <td className={tdCls}>{a.mouse ? "✓" : "—"}</td>
                      <td className={tdCls}>{a.charger ? "✓" : "—"}</td>
                      <td className={tdCls}>{a.idCard ? "✓" : "—"}</td>
                      <td className={tdCls}>{a.oemName ?? "—"}</td>
                      <td className={tdCls}><span className="nums">{fmtDate(a.allocatedAt) ?? "—"}</span></td>
                      <td className={tdCls}><span className="nums">{fmtDate(a.returnedAt) ?? "—"}</span></td>
                      {canWrite && (
                        <td className={tdCls}>
                          <AssetRowActions
                            asset={{
                              id: a.id, employeeId: a.employee.id,
                              hasLaptop: a.hasLaptop, laptopBag: a.laptopBag, mouse: a.mouse, charger: a.charger, idCard: a.idCard,
                              lpSerialNo: a.lpSerialNo ?? "", makeModel: a.makeModel ?? "", lpCategory: a.lpCategory ?? "", oemName: a.oemName ?? "",
                              returnedAt: a.returnedAt ? a.returnedAt.toISOString().slice(0, 10) : "",
                            }}
                            employees={employees}
                          />
                        </td>
                      )}
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
