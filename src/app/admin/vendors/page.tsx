import Link from "next/link";
import { Suspense } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import Badge from "@/components/Badge";
import VendorSearch from "@/components/VendorSearch";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set([
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
]);

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
    include: { _count: { select: { projects: true, documents: true } } },
  });

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8">
        <h1 className="text-lg font-semibold text-slate-900">Vendors</h1>
        <span className="ml-3 text-sm text-slate-400">{vendors.length} result(s)</span>
      </header>

      <div className="p-8 space-y-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <Suspense fallback={<div className="h-10" />}>
            <VendorSearch />
          </Suspense>
        </div>

        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {vendors.length === 0 ? (
            <p className="text-sm text-slate-500 p-6">No vendors match your search.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-100">
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">GST</th>
                    <th className="py-3 px-4">PAN</th>
                    <th className="py-3 px-4">State</th>
                    <th className="py-3 px-4">Projects</th>
                    <th className="py-3 px-4">Docs</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => (
                    <tr key={v.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-medium">
                        <Link href={`/admin/vendors/${v.id}`} className="text-brand hover:underline">
                          {v.companyName}
                        </Link>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{v.contactPerson || "—"}</td>
                      <td className="py-2.5 px-4 text-slate-600">{v.email}</td>
                      <td className="py-2.5 px-4 text-slate-600">{v.gstNo}</td>
                      <td className="py-2.5 px-4 text-slate-600">{v.panNo}</td>
                      <td className="py-2.5 px-4 text-slate-600">{v.state || "—"}</td>
                      <td className="py-2.5 px-4 text-slate-500">{v._count.projects}</td>
                      <td className="py-2.5 px-4 text-slate-500">{v._count.documents}</td>
                      <td className="py-2.5 px-4"><Badge value={v.status} /></td>
                      <td className="py-2.5 px-4 text-slate-500">{fmtDate(v.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
