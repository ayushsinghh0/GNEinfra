import { Suspense } from "react";
import { Prisma } from "@prisma/client";
import { Building2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import VendorSearch from "@/components/VendorSearch";
import VendorRow from "@/components/VendorRow";
import { PageHeader, Card, CardBody, EmptyState, thCls, theadRowCls } from "@/components/ui";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"]);

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  if (!(await isAdminAuthed())) return null;

  const { q, status } = await searchParams;

  const where: Prisma.VendorWhereInput = {};
  if (status && VALID_STATUS.has(status)) {
    where.status = status as Prisma.VendorWhereInput["status"];
  }
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { companyName: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { gstNo: { contains: term, mode: "insensitive" } },
      { panNo: { contains: term, mode: "insensitive" } },
      { contactPerson: { contains: term, mode: "insensitive" } },
    ];
  }

  const vendors = await prisma.vendor.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { services: true, documents: true } } },
  });

  return (
    <>
      <PageHeader title="Vendors" subtitle={`${vendors.length} result(s)`} />

      <div className="p-8 space-y-6">
        <Card>
          <CardBody className="p-4">
            <Suspense fallback={<div className="h-10" />}>
              <VendorSearch />
            </Suspense>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          {vendors.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title="No vendors found"
              description="No vendors match your search. Try a different term or status filter."
            />
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] table-fixed text-sm">
              <colgroup>
                <col className="w-[19%]" />
                <col className="w-[20%]" />
                <col className="w-[15%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
                <col className="w-[13%]" />
                <col className="w-[11%]" />
              </colgroup>
              <thead>
                <tr className={theadRowCls}>
                  <th className={thCls}>Company</th>
                  <th className={thCls}>Email</th>
                  <th className={thCls}>GST / PAN</th>
                  <th className={thCls}>State</th>
                  <th className={thCls}>Activity</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <VendorRow
                    key={v.id}
                    v={{
                      id: v.id,
                      companyName: v.companyName,
                      contactPerson: v.contactPerson,
                      email: v.email,
                      gstNo: v.gstNo ?? "",
                      panNo: v.panNo ?? "",
                      state: v.state,
                      services: v._count.services,
                      documents: v._count.documents,
                      status: v.status,
                      submitted: fmtDate(v.createdAt),
                    }}
                  />
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
