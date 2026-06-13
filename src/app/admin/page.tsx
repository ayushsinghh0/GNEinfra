import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import Badge from "@/components/Badge";
import InviteForm from "@/components/InviteForm";

export const dynamic = "force-dynamic";

function Card({
  label,
  value,
  accent,
  href,
}: {
  label: string;
  value: number;
  accent: string;
  href?: string;
}) {
  const inner = (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition">
      <div className={`text-3xl font-bold ${accent}`}>{value}</div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function DashboardPage() {
  // Guard BEFORE any DB query: the layout shows the login screen, but Next still
  // executes this component, so we must not fetch data when unauthenticated.
  if (!(await isAdminAuthed())) return null;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [total, awaiting, approved, pendingInvites, thisMonth, recent] =
    await Promise.all([
      prisma.vendor.count(),
      prisma.vendor.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
      prisma.vendor.count({ where: { status: "APPROVED" } }),
      prisma.vendorInvite.count({ where: { status: "PENDING" } }),
      prisma.vendor.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.vendor.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { _count: { select: { projects: true, documents: true } } },
      }),
    ]);

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8">
        <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
      </header>

      <div className="p-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card label="Total vendors" value={total} accent="text-slate-900" href="/admin/vendors" />
          <Card label="Awaiting review" value={awaiting} accent="text-amber-600" href="/admin/vendors?status=SUBMITTED" />
          <Card label="Approved" value={approved} accent="text-emerald-600" href="/admin/vendors?status=APPROVED" />
          <Card label="Pending invites" value={pendingInvites} accent="text-blue-600" href="/admin/invites" />
          <Card label="This month" value={thisMonth} accent="text-slate-900" />
        </div>

        <InviteForm />

        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Recent vendors</h2>
            <Link href="/admin/vendors" className="text-sm text-brand hover:underline">
              View all →
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500">
              No vendors yet. Invite one above to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="py-2 pr-4">Company</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">GST</th>
                    <th className="py-2 pr-4">Projects</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((v) => (
                    <tr key={v.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 pr-4 font-medium">
                        <Link href={`/admin/vendors/${v.id}`} className="text-brand hover:underline">
                          {v.companyName}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-slate-600">{v.email}</td>
                      <td className="py-2 pr-4 text-slate-600">{v.gstNo}</td>
                      <td className="py-2 pr-4 text-slate-500">{v._count.projects}</td>
                      <td className="py-2 pr-4"><Badge value={v.status} /></td>
                      <td className="py-2 pr-4 text-slate-500">{fmtDate(v.createdAt)}</td>
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
