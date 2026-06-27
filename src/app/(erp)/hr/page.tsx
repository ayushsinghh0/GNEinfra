import Link from "next/link";
import { Users, CalendarClock, BadgeIndianRupee, BarChart2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { fmtINR } from "@/lib/format";
import { BrandHero } from "@/components/chrome";
import { StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HrPage() {
  await requirePageRole(HR_VIEW);

  const today = new Date();
  const todayUTC = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  const periodYear = today.getUTCFullYear();
  const periodMonth = today.getUTCMonth() + 1;

  const [active, attByStatus, payrollAgg] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { date: todayUTC },
      _count: { _all: true },
    }),
    prisma.payrollRecord.aggregate({
      where: { periodYear, periodMonth },
      _sum: { payableAmount: true },
    }),
  ]);

  const presentCount =
    attByStatus.find((r) => r.status === "PRESENT")?._count._all ?? 0;
  const onLeaveCount =
    attByStatus.find((r) => r.status === "LEAVE")?._count._all ?? 0;
  const netPayroll = payrollAgg._sum.payableAmount ?? 0;

  const quickLinks = [
    {
      href: "/hr/employees",
      label: "Employees",
      icon: Users,
      desc: "View and manage employee records.",
    },
    {
      href: "/hr/attendance",
      label: "Attendance",
      icon: CalendarClock,
      desc: "Track daily attendance and leave.",
    },
    {
      href: "/hr/payout",
      label: "Payout",
      icon: BadgeIndianRupee,
      desc: "Process and review monthly payroll.",
    },
    {
      href: "/hr/analytics",
      label: "Analytics",
      icon: BarChart2,
      desc: "Headcount trends and payroll insights.",
    },
  ];

  return (
    <>
      <BrandHero
        variant="mint"
        size="sm"
        wave={false}
        eyebrow="Human Resources"
        title="HR Dashboard"
        subtitle="Headcount, attendance and payroll at a glance."
        className="px-6 pb-7 pt-9 sm:px-8"
      />
      <div className="space-y-8 p-6 sm:p-8">
        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Active headcount"
            value={active}
            tone="brand"
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            label="Present today"
            value={presentCount}
            tone="emerald"
            icon={<CalendarClock className="h-4 w-4" />}
          />
          <StatCard label="On leave today" value={onLeaveCount} tone="amber" />
          <StatCard
            label="This month net payroll"
            value={fmtINR(netPayroll)}
            tone="blue"
            icon={<BadgeIndianRupee className="h-4 w-4" />}
          />
        </div>

        {/* Quick-link cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {quickLinks.map(({ href, label, icon: Icon, desc }) => (
            <Link
              key={href}
              href={href}
              className="group block rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-cta)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-100">
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold text-slate-900">{label}</div>
              <div className="mt-1 text-xs leading-relaxed text-slate-500">{desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
