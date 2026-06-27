import { Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { fmtDate } from "@/lib/format";
import AssetForm from "@/components/hr/AssetForm";
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

export default async function AssetsPage() {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);

  const [assets, employees] = await Promise.all([
    prisma.employeeAsset.findMany({
      include: { employee: { select: { empId: true, name: true } } },
      orderBy: { allocatedAt: "desc" },
    }),
    canWrite
      ? prisma.employee.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, empId: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Asset Register" subtitle={`${assets.length} record(s)`} />

      <div className="p-8 space-y-6">
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
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className={theadRowCls}>
                    <th className={thCls}>Employee</th>
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
                      <td className={tdCls}>{a.hasLaptop ? "✓" : "—"}</td>
                      <td className={tdCls}>{a.lpSerialNo ?? "—"}</td>
                      <td className={tdCls}>{a.makeModel ?? "—"}</td>
                      <td className={tdCls}>{a.laptopBag ? "✓" : "—"}</td>
                      <td className={tdCls}>{a.mouse ? "✓" : "—"}</td>
                      <td className={tdCls}>{a.charger ? "✓" : "—"}</td>
                      <td className={tdCls}>{a.idCard ? "✓" : "—"}</td>
                      <td className={tdCls}>{a.oemName ?? "—"}</td>
                      <td className={tdCls}>
                        <span className="nums">{fmtDate(a.allocatedAt) ?? "—"}</span>
                      </td>
                      <td className={tdCls}>
                        <span className="nums">{fmtDate(a.returnedAt) ?? "—"}</span>
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
