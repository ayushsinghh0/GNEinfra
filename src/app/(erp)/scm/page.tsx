import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageRole, VENDOR_VIEW, VENDOR_WRITE } from "@/lib/rbac";
import { ComingSoon } from "@/components/ComingSoon";
import { fmtDate } from "@/lib/format";
import InviteForm from "@/components/InviteForm";
import CountUp from "@/components/CountUp";
import { AreaChart, Donut } from "@/components/Charts";
import { BrandHero } from "@/components/chrome";
import { DataTable, type Column } from "@/components/DataTable";
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
  ClipboardList,
  FileText,
  ReceiptText,
  Truck,
  Boxes,
  Wrench,
} from "lucide-react";
import {
  StatCard,
  Card,
  CardHeader,
  CardBody,
  EmptyState,
  EntityLink,
  StatusChip,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const viewer = await requirePageRole(VENDOR_VIEW);

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

  type Vendor = (typeof recent)[number];
  const recentColumns: Column<Vendor>[] = [
    {
      key: "company",
      header: "Company",
      titleInCard: true,
      cell: (v) => (
        <span className="relative z-10">
          <EntityLink
            href={`/scm/vendors/${v.id}`}
            name={v.companyName}
            code={v.vendorCode ?? undefined}
          />
        </span>
      ),
    },
    {
      key: "email",
      header: "Email",
      priority: "md",
      cardLabel: "Email",
      cell: (v) => <span className="text-slate-600">{v.email}</span>,
    },
    {
      key: "activity",
      header: "Activity",
      priority: "lg",
      cardLabel: "Activity",
      cell: (v) => (
        <span className="inline-flex items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1" title={`${v._count.services} service(s)`}>
            <Wrench className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            {v._count.services}
          </span>
          <span className="inline-flex items-center gap-1" title={`${v._count.documents} document(s)`}>
            <FileText className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            {v._count.documents}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cardLabel: "Status",
      cell: (v) => <StatusChip status={v.status} />,
    },
    {
      key: "submitted",
      header: "Submitted",
      priority: "md",
      cardLabel: "Submitted",
      cell: (v) => <span className="nums text-slate-500">{fmtDate(v.createdAt)}</span>,
    },
  ];

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
        {/* KPI bento — every tile drills into the list it summarizes. */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard
            label="Total vendors"
            value={<CountUp value={total} />}
            tone="brand"
            spark={100}
            icon={<Building2 className="h-[18px] w-[18px]" />}
            href="/scm/vendors"
          />
          <StatCard
            label="Awaiting review"
            value={<CountUp value={awaiting} />}
            tone="amber"
            spark={pct(awaiting)}
            icon={<Clock className="h-[18px] w-[18px]" />}
            href="/scm/vendors?status=SUBMITTED"
          />
          <StatCard
            label="Approved"
            value={<CountUp value={approved} />}
            tone="emerald"
            spark={pct(approved)}
            icon={<CheckCircle className="h-[18px] w-[18px]" />}
            href="/scm/vendors?status=APPROVED"
          />
          <StatCard
            label="Pending invites"
            value={<CountUp value={pendingInvites} />}
            tone="blue"
            icon={<Mail className="h-[18px] w-[18px]" />}
            href="/scm/invites?status=PENDING"
          />
          <StatCard
            label="This month"
            value={<CountUp value={thisMonth} />}
            tone="slate"
            icon={<CalendarDays className="h-[18px] w-[18px]" />}
          />
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
              <AreaChart data={months} ariaLabel="New vendor registrations over the last 6 months" />
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

        {VENDOR_WRITE.includes(viewer.role) && <InviteForm />}

        <Card className="overflow-hidden">
          <CardHeader
            title="Recent vendors"
            action={
              <Link
                href="/scm/vendors"
                className="press inline-flex items-center gap-1 text-sm font-medium text-brand-700 transition-colors hover:text-brand"
              >
                View all
                <ChevronRight className="h-4 w-4" />
              </Link>
            }
          />
          <DataTable
            rows={recent}
            columns={recentColumns}
            rowKey={(v) => v.id}
            href={(v) => `/scm/vendors/${v.id}`}
            empty={
              <EmptyState
                icon={<Inbox className="h-6 w-6" />}
                title="No vendors yet"
                description="Invite a vendor above to get started — their submissions will appear here."
              />
            }
          />
        </Card>

        <ComingSoon
          items={[
            { label: "Purchase Requisition", icon: ClipboardList, desc: "Raise and track material requisitions." },
            { label: "RFQ", icon: FileText, desc: "Request quotations from vendors." },
            { label: "Purchase Order", icon: ReceiptText, desc: "Issue and manage purchase orders." },
            { label: "GRN", icon: Truck, desc: "Goods receipt against POs." },
            { label: "Inventory", icon: Boxes, desc: "Materials receipt, store and issue." },
          ]}
        />
      </div>
    </>
  );
}
