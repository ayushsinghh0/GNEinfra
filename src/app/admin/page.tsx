import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import Badge from "@/components/Badge";
import InviteForm from "@/components/InviteForm";
import CountUp from "@/components/CountUp";
import { AreaChart, Donut } from "@/components/Charts";
import { BrandHero } from "@/components/chrome";
import {
  Building2,
  Clock,
  CheckCircle,
  Mail,
  CalendarDays,
  ChevronRight,
  Inbox,
  TrendingUp,
  PieChart,
} from "lucide-react";
import {
  StatCard,
  Card,
  CardHeader,
  CardBody,
  EmptyState,
  Table,
  thCls,
  tdCls,
  theadRowCls,
  trCls,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Guard BEFORE any DB query: the layout shows the login screen, but Next still
  // executes this component, so we must not fetch data when unauthenticated.
  if (!(await isAdminAuthed())) return null;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [total, awaiting, approved, pendingInvites, thisMonth, recent, statusGroups, monthlyRaw] =
    await Promise.all([
      prisma.vendor.count(),
      prisma.vendor.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
      prisma.vendor.count({ where: { status: "APPROVED" } }),
      prisma.vendorInvite.count({
        where: { status: "PENDING", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      }),
      prisma.vendor.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.vendor.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { _count: { select: { services: true, documents: true } } },
      }),
      prisma.vendor.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.$queryRaw<{ month: Date; count: number }[]>`
        SELECT date_trunc('month', "createdAt") AS month, count(*)::int AS count
        FROM "Vendor"
        WHERE "createdAt" >= date_trunc('month', now()) - interval '5 months'
        GROUP BY 1 ORDER BY 1
      `,
    ]);

  // Build a fixed 6-month series (fill gaps with 0).
  const monthCounts = new Map(
    monthlyRaw.map((r) => [`${r.month.getFullYear()}-${r.month.getMonth()}`, Number(r.count)])
  );
  const months = Array.from({ length: 6 }, (_, idx) => {
    const d = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() - (5 - idx), 1);
    return {
      label: d.toLocaleString("en-IN", { month: "short" }),
      value: monthCounts.get(`${d.getFullYear()}-${d.getMonth()}`) ?? 0,
    };
  });

  const STATUS_LABELS: Record<string, string> = {
    SUBMITTED: "Submitted",
    UNDER_REVIEW: "Under review",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  };
  const statusCounts = new Map(statusGroups.map((g) => [g.status, g._count._all]));
  const statusData = (["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"] as const).map((s) => ({
    status: s,
    label: STATUS_LABELS[s],
    value: statusCounts.get(s) ?? 0,
  }));

  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <>
      <BrandHero
        variant="mint"
        size="sm"
        wave={false}
        eyebrow="GNE Procurement"
        title="Dashboard"
        subtitle="Your supplier pipeline at a glance."
        className="px-6 pb-7 pt-9 sm:px-8"
      />

      <div className="space-y-6 p-6 sm:p-8">
        {/* KPI bento */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Link href="/admin/vendors" className="block">
            <StatCard label="Total vendors" value={<CountUp value={total} />} tone="brand" spark={100} icon={<Building2 className="h-[18px] w-[18px]" />} />
          </Link>
          <Link href="/admin/vendors?status=SUBMITTED" className="block">
            <StatCard label="Awaiting review" value={<CountUp value={awaiting} />} tone="amber" spark={pct(awaiting)} icon={<Clock className="h-[18px] w-[18px]" />} />
          </Link>
          <Link href="/admin/vendors?status=APPROVED" className="block">
            <StatCard label="Approved" value={<CountUp value={approved} />} tone="emerald" spark={pct(approved)} icon={<CheckCircle className="h-[18px] w-[18px]" />} />
          </Link>
          <Link href="/admin/invites" className="block">
            <StatCard label="Pending invites" value={<CountUp value={pendingInvites} />} tone="blue" icon={<Mail className="h-[18px] w-[18px]" />} />
          </Link>
          <StatCard label="This month" value={<CountUp value={thisMonth} />} tone="slate" icon={<CalendarDays className="h-[18px] w-[18px]" />} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-[18px] w-[18px] text-brand" />
                  Registrations
                </span>
              }
              subtitle="New vendors per month (last 6 months)"
            />
            <CardBody>
              <AreaChart data={months} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <PieChart className="h-[18px] w-[18px] text-brand" />
                  By status
                </span>
              }
              subtitle="Vendor pipeline"
            />
            <CardBody>
              <Donut data={statusData} />
            </CardBody>
          </Card>
        </div>

        <InviteForm />

        <Card>
          <CardHeader
            title="Recent vendors"
            action={
              <Link
                href="/admin/vendors"
                className="press inline-flex items-center gap-1 text-sm font-medium text-brand-700 transition-colors hover:text-brand"
              >
                View all
                <ChevronRight className="h-4 w-4" />
              </Link>
            }
          />
          {recent.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-6 w-6" />}
              title="No vendors yet"
              description="Invite a vendor above to get started — their submissions will appear here."
            />
          ) : (
            <CardBody className="pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <thead>
                    <tr className={theadRowCls}>
                      <th className={thCls}>Company</th>
                      <th className={thCls}>Email</th>
                      <th className={thCls}>GST</th>
                      <th className={thCls}>Services</th>
                      <th className={thCls}>Status</th>
                      <th className={thCls}>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((v) => (
                      <tr key={v.id} className={trCls}>
                        <td className={tdCls}>
                          <Link
                            href={`/admin/vendors/${v.id}`}
                            className="font-medium text-slate-900 transition-colors hover:text-brand-700"
                          >
                            {v.companyName}
                          </Link>
                        </td>
                        <td className={tdCls}>
                          <span className="text-slate-600">{v.email}</span>
                        </td>
                        <td className={tdCls}>
                          <span className="nums text-slate-600">{v.gstNo || "—"}</span>
                        </td>
                        <td className={tdCls}>
                          <span className="nums text-slate-500">{v._count.services}</span>
                        </td>
                        <td className={tdCls}>
                          <Badge value={v.status} />
                        </td>
                        <td className={tdCls}>
                          <span className="nums text-slate-500">{fmtDate(v.createdAt)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </CardBody>
          )}
        </Card>
      </div>
    </>
  );
}
