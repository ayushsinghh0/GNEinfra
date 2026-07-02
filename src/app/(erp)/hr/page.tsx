import Link from "next/link";
import { Suspense } from "react";
import { Users, Wallet, CalendarCheck, UserMinus, Clock, FolderKanban, CalendarClock, BadgeIndianRupee } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { fmtINR } from "@/lib/format";
import { BrandHero } from "@/components/chrome";
import { StatCard, Skeleton } from "@/components/ui";
import { DeltaBadge } from "@/components/Charts";
import { pctDelta } from "@/lib/hr-forecast";
import { getPeriods, periodKey, monthlyAttendanceStats } from "@/lib/hr-dashboard";
import DashboardTrends from "@/components/hr/DashboardTrends";
import DashboardComposition from "@/components/hr/DashboardComposition";
import MonthPicker from "@/components/hr/MonthPicker";

export const dynamic = "force-dynamic";

export default async function HrPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  await requirePageRole(HR_VIEW);

  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const todayY = today.getUTCFullYear();
  const todayM = today.getUTCMonth() + 1;

  // Reference month picker (MonthPicker, mirrors attendance/payout) — defaults to the
  // current month, clamped like every other HR month-scoped page. This is the "as-of"
  // anchor for the trend window + the payroll / attrition / headcount-at-month-end KPIs
  // below (each re-derives its `periods`/`cur`/`prev` from it). It does NOT drive the
  // "present/on-leave today" pulse metrics, which stay real-time "today" regardless of
  // the picker — labeled honestly ("today", linking to today's actual attendance date)
  // rather than silently relabeled under a past reference month.
  const sp = await searchParams;
  const refYear = Math.max(2000, Math.min(2100, Number(sp.year) || todayY));
  const refMonth = Math.max(1, Math.min(12, Number(sp.month) || todayM));
  const isCurrentRefMonth = refYear === todayY && refMonth === todayM;
  const refAnchor = new Date(Date.UTC(refYear, refMonth - 1, 1));

  const { periods, cur, prev } = getPeriods(refAnchor);

  // Lightweight KPI query set — scoped to just the current + previous period (rather
  // than the full 12-month series the streamed sections below compute for their charts),
  // so this resolves quickly and the KPI band paints before the heavier 12-month
  // aggregations finish. See DashboardTrends/DashboardComposition for the streamed,
  // independently-queried heavy sections (Suspense boundaries below) — same underlying
  // data, re-fetched at the granularity each part actually needs (correctness over
  // dedupe).
  const [
    attTodayG,
    leaversCur,
    leaversPrev,
    headcountCur,
    headcountPrev,
    payrollGroups,
    attCur,
    attPrev,
  ] = await Promise.all([
    prisma.attendanceRecord.groupBy({ by: ["status"], where: { date: todayUTC }, _count: { _all: true } }),
    prisma.employee.count({ where: { leavingDate: { gte: cur.start, lt: cur.end } } }),
    prisma.employee.count({ where: { leavingDate: { gte: prev.start, lt: prev.end } } }),
    prisma.employee.count({ where: { dateOfJoining: { lt: cur.end }, OR: [{ leavingDate: null }, { leavingDate: { gte: cur.end } }] } }),
    prisma.employee.count({ where: { dateOfJoining: { lt: prev.end }, OR: [{ leavingDate: null }, { leavingDate: { gte: prev.end } }] } }),
    // Batched across all 12 periods in one round trip (vs. 12 individual aggregates) —
    // needed because "last processed payroll" scans backward for the last non-zero
    // month, which isn't knowable from just the current + previous period.
    prisma.payrollRecord.groupBy({
      by: ["periodYear", "periodMonth"],
      where: { OR: periods.map((p) => ({ periodYear: p.year, periodMonth: p.month })) },
      _sum: { payableAmount: true },
    }),
    monthlyAttendanceStats(cur.start, cur.end),
    monthlyAttendanceStats(prev.start, prev.end),
  ]);

  // Today / attrition.
  const presentToday = attTodayG.find((r) => r.status === "PRESENT")?._count._all ?? 0;
  const onLeaveToday = (attTodayG.find((r) => r.status === "LEAVE")?._count._all ?? 0) + (attTodayG.find((r) => r.status === "SICK")?._count._all ?? 0);
  const attritionDelta = pctDelta(leaversCur, leaversPrev);

  // Headcount delta (this month-end vs last).
  const headcountDelta = pctDelta(headcountCur, headcountPrev);

  // Attendance rate (MTD) delta.
  const attRateDelta = pctDelta(attCur.rate, attPrev.rate);

  // Payroll → anchor on last non-zero month (mirrors the TrendBoard payroll series'
  // "scan backward" rule), net payroll processed this month for the footer note.
  const payrollMap = new Map(payrollGroups.map((g) => [periodKey({ year: g.periodYear, month: g.periodMonth }), g._sum.payableAmount ?? 0]));
  let lastActual = periods.length - 1;
  while (lastActual > 0 && (payrollMap.get(periodKey(periods[lastActual])) ?? 0) === 0) lastActual--;
  const costAnchor = payrollMap.get(periodKey(periods[lastActual])) ?? 0;
  const costDelta = pctDelta(costAnchor, lastActual > 0 ? (payrollMap.get(periodKey(periods[lastActual - 1])) ?? 0) : 0);
  const netPayrollMonth = payrollMap.get(periodKey(cur)) ?? 0;

  const quickLinks = [
    { href: "/hr/employees", label: "Employees", icon: Users, desc: "View and manage employee records." },
    { href: "/hr/attendance", label: "Attendance", icon: CalendarClock, desc: "Track daily attendance and leave." },
    { href: "/hr/payout", label: "Payout", icon: BadgeIndianRupee, desc: "Process and review monthly payroll." },
    { href: "/hr/projects", label: "Projects", icon: FolderKanban, desc: "Projects and concurrent assignments." },
  ];

  return (
    <>
      <BrandHero variant="mint" size="sm" wave={false} eyebrow="Human Resources" title="HR Dashboard" subtitle="Workforce, payroll and attendance — with trend projections." className="px-6 pb-7 pt-9 sm:px-8">
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Viewing</span>
          <MonthPicker year={refYear} month={refMonth} basePath="/hr" />
          {!isCurrentRefMonth && (
            <Link
              href="/hr"
              className="press inline-flex h-8 items-center rounded-xl px-3 text-sm font-medium text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              This month
            </Link>
          )}
        </div>
      </BrandHero>
      <div className="space-y-8 p-6 sm:p-8">
        {/* KPI bento with deltas — paints before the heavier sections below stream in.
            Headcount/payroll/attendance-rate/attrition re-anchor to the reference month
            above; present/on-leave stay real-time "today" (see comment above `refYear`). */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard tone="brand" icon={<Users className="h-4 w-4" />} label={`Headcount · ${cur.label} ${refYear}`}
            href="/hr/employees?status=ACTIVE"
            value={<span className="flex flex-wrap items-baseline gap-2"><span>{headcountCur}</span><DeltaBadge value={headcountDelta} /></span>} />
          <StatCard tone="emerald" icon={<Wallet className="h-4 w-4" />} label={`Payroll · ${periods[lastActual].label} ${periods[lastActual].year}`}
            href={`/hr/payout?year=${periods[lastActual].year}&month=${periods[lastActual].month}`}
            value={<span className="flex flex-wrap items-baseline gap-2"><span>{fmtINR(costAnchor)}</span><DeltaBadge value={costDelta} /></span>} />
          <StatCard tone="blue" icon={<CalendarCheck className="h-4 w-4" />} label={isCurrentRefMonth ? "Attendance rate (MTD)" : `Attendance rate · ${cur.label}`}
            href={`/hr/attendance?year=${refYear}&month=${refMonth}`}
            value={<span className="flex flex-wrap items-baseline gap-2"><span>{attCur.rate}%</span><DeltaBadge value={attRateDelta} /></span>} />
          <StatCard tone="emerald" icon={<CalendarCheck className="h-4 w-4" />} label="Present today"
            href={`/hr/attendance?year=${todayY}&month=${todayM}`} value={presentToday} />
          <StatCard tone="amber" icon={<Clock className="h-4 w-4" />} label="On leave today"
            href={`/hr/attendance?year=${todayY}&month=${todayM}`} value={onLeaveToday} />
          <StatCard tone="amber" icon={<UserMinus className="h-4 w-4" />} label={`Attrition · ${cur.label} ${refYear}`}
            href="/hr/employees?status=INACTIVE"
            value={<span className="flex flex-wrap items-baseline gap-2"><span>{leaversCur}</span><DeltaBadge value={attritionDelta} invert /></span>} />
        </div>

        {/* Pill-driven trend board — heaviest section (12x monthly aggregations), streamed.
            Window ends at the reference month, not necessarily "now". */}
        <Suspense fallback={<Skeleton className="h-[420px] w-full rounded-2xl" />}>
          <DashboardTrends year={refYear} month={refMonth} />
        </Suspense>

        {/* Utilization + leave burn + workforce composition, streamed. Kept as a
            current-snapshot ("now") rather than re-anchored to the reference month —
            it's workforce composition/utilization, not a monthly KPI. */}
        <Suspense
          fallback={
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <Skeleton className="h-64 rounded-2xl" />
                <Skeleton className="h-64 rounded-2xl" />
              </div>
              <Skeleton className="h-96 rounded-2xl" />
            </div>
          }
        >
          <DashboardComposition today={todayUTC} />
        </Suspense>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {quickLinks.map(({ href, label, icon: Icon, desc }) => (
            <Link key={href} href={href} className="group block rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] motion-safe:transition hover:motion-safe:-translate-y-0.5 hover:shadow-[var(--shadow-cta)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 motion-safe:transition group-hover:bg-brand-100"><Icon className="h-5 w-5" /></div>
              <div className="text-sm font-semibold text-slate-900">{label}</div>
              <div className="mt-1 text-xs leading-relaxed text-slate-500">{desc}</div>
            </Link>
          ))}
        </div>

        <p className="text-center text-[11px] text-slate-400">&quot;Projected&quot; values are least-squares trend extrapolations, not guarantees · {netPayrollMonth ? `${fmtINR(netPayrollMonth)} processed ${isCurrentRefMonth ? "this month" : `in ${cur.label} ${refYear}`}` : `no payroll processed ${isCurrentRefMonth ? "yet this month" : `in ${cur.label} ${refYear}`}`}</p>
      </div>
    </>
  );
}
