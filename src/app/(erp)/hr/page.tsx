import Link from "next/link";
import { Suspense } from "react";
import { Users, Wallet, CalendarCheck, UserMinus, Clock, FolderKanban, CalendarClock, BadgeIndianRupee, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { fmtINR } from "@/lib/format";
import { BrandHero } from "@/components/chrome";
import { StatCard, Skeleton, Card, CardHeader, CardBody } from "@/components/ui";
import { DeltaBadge } from "@/components/Charts";
import { pctDelta } from "@/lib/hr-forecast";
import { getPeriods, periodKey, monthlyAttendanceStats } from "@/lib/hr-dashboard";
import DashboardTrends from "@/components/hr/DashboardTrends";
import { DashboardLeaveBurn, DashboardUtilization, DashboardWorkforceComposition } from "@/components/hr/DashboardComposition";
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
  // Any attendance row at all for today (any status) — distinguishes "0 present because
  // nobody's marked yet" from "0 present, and that's a real reading" (see KPI honesty notes below).
  const todayHasRows = attTodayG.reduce((s, r) => s + r._count._all, 0) > 0;
  const attritionDelta = pctDelta(leaversCur, leaversPrev);
  // A -100%/-∞% badge on tiny integers (e.g. 1 leaver → 0) is noise, not signal — only badge
  // when BOTH months had at least one real leaver to compare.
  const showAttritionDelta = leaversCur >= 1 && leaversPrev >= 1 && attritionDelta !== null;

  // Headcount delta (this month-end vs last).
  const headcountDelta = pctDelta(headcountCur, headcountPrev);
  const showHeadcountDelta = headcountDelta !== null;

  // Attendance rate (MTD) delta — only meaningful when BOTH periods actually have attendance
  // rows; `total` (added to monthlyAttendanceStats) is free from the same groupBy query.
  const attRateDelta = pctDelta(attCur.rate, attPrev.rate);
  const attCurHasRows = attCur.total > 0;
  const showAttRateDelta = attCurHasRows && attPrev.total > 0 && attRateDelta !== null;

  // Payroll → anchor on last non-zero month (mirrors the TrendBoard payroll series'
  // "scan backward" rule), net payroll processed this month for the footer note.
  const payrollMap = new Map(payrollGroups.map((g) => [periodKey({ year: g.periodYear, month: g.periodMonth }), g._sum.payableAmount ?? 0]));
  let lastActual = periods.length - 1;
  while (lastActual > 0 && (payrollMap.get(periodKey(periods[lastActual])) ?? 0) === 0) lastActual--;
  const costAnchor = payrollMap.get(periodKey(periods[lastActual])) ?? 0;
  const costDelta = pctDelta(costAnchor, lastActual > 0 ? (payrollMap.get(periodKey(periods[lastActual - 1])) ?? 0) : 0);
  const netPayrollMonth = payrollMap.get(periodKey(cur)) ?? 0;
  // The anchor month is still in progress (today's calendar month, not yet closed) — comparing
  // a partially-processed month against a fully-processed prior one is an apples-to-oranges
  // delta, so swap the badge for an honest "so far this month" caption instead.
  const payrollAnchorOngoing = isCurrentRefMonth && lastActual === periods.length - 1;
  const showPayrollDelta = !payrollAnchorOngoing && costDelta !== null;

  const quickLinks = [
    { href: "/hr/employees", label: "Employees", icon: Users },
    { href: "/hr/attendance", label: "Attendance", icon: CalendarClock },
    { href: "/hr/payout", label: "Payout", icon: BadgeIndianRupee },
    { href: "/hr/projects", label: "Projects", icon: FolderKanban },
  ];

  return (
    <>
      <BrandHero variant="mint" size="sm" wave={false} eyebrow="Human Resources" title="HR Dashboard" subtitle="Workforce, payroll and attendance — with trend projections." className="px-6 pb-7 pt-9 sm:px-8">
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Viewing</span>
          <MonthPicker year={refYear} month={refMonth} basePath="/hr" />
        </div>
      </BrandHero>
      <div className="space-y-5 p-6 sm:p-8">
        {/* 12-col bento (lg+) — 3 rows, each pair of cells summing to 12 columns so the
            grid packs with zero dead space; single column on mobile, same row order.
            Row 1: KPI cluster (8) + Leave-burn rings (4). Row 2: Trends (8) + Project
            utilization (4). Row 3: Workforce composition (7) + "Today" pulse card (5). */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Row 1A — KPI cluster. Deltas paint before the heavier sections below
              stream in. Headcount/payroll/attendance-rate/attrition re-anchor to the
              reference month above; present/on-leave live in the Today pulse card
              (Row 3B) and stay real-time "today" regardless of the picker. */}
          <div className="lg:col-span-8">
            <div className="grid grid-cols-2 gap-4">
              <StatCard tone="brand" icon={<Users className="h-4 w-4" />} label={`Headcount · ${cur.label} ${refYear}`}
                href="/hr/employees?status=ACTIVE"
                value={<span className="flex flex-wrap items-baseline gap-2"><span>{headcountCur}</span>{showHeadcountDelta && <DeltaBadge value={headcountDelta} />}</span>} />
              <StatCard tone="emerald" icon={<Wallet className="h-4 w-4" />} label={`Payroll · ${periods[lastActual].label} ${periods[lastActual].year}`}
                href={`/hr/payout?year=${periods[lastActual].year}&month=${periods[lastActual].month}`}
                value={
                  <>
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span>{fmtINR(costAnchor)}</span>
                      {showPayrollDelta && <DeltaBadge value={costDelta} />}
                    </span>
                    {payrollAnchorOngoing && <p className="mt-1 text-xs text-slate-500">so far this month</p>}
                  </>
                } />
              <StatCard tone="blue" icon={<CalendarCheck className="h-4 w-4" />} label={isCurrentRefMonth ? "Attendance rate (MTD)" : `Attendance rate · ${cur.label}`}
                href={`/hr/attendance?year=${refYear}&month=${refMonth}`}
                spark={attCurHasRows ? attCur.rate : undefined}
                value={
                  <>
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span className={attCurHasRows ? undefined : "text-slate-300"}>{attCurHasRows ? `${attCur.rate}%` : "—"}</span>
                      {showAttRateDelta && <DeltaBadge value={attRateDelta} />}
                    </span>
                    {!attCurHasRows && (
                      <p className="mt-1 text-xs font-medium text-brand-600">
                        {isCurrentRefMonth ? `No attendance marked for ${cur.label} yet` : `No attendance recorded for ${cur.label}`}
                      </p>
                    )}
                  </>
                } />
              <StatCard tone="amber" icon={<UserMinus className="h-4 w-4" />} label={`Attrition · ${cur.label} ${refYear}`}
                href="/hr/employees?status=INACTIVE"
                value={<span className="flex flex-wrap items-baseline gap-2"><span>{leaversCur}</span>{showAttritionDelta && <DeltaBadge value={attritionDelta} invert />}</span>} />
            </div>
          </div>

          {/* Row 1B — Leave-burn rings. */}
          <div className="lg:col-span-4">
            <Suspense fallback={<Skeleton className="h-72 w-full rounded-2xl" />}>
              <DashboardLeaveBurn today={todayUTC} />
            </Suspense>
          </div>

          {/* Row 2A — Pill-driven trend board, heaviest section (12x monthly
              aggregations), streamed. Window ends at the reference month. */}
          <div className="lg:col-span-8">
            <Suspense fallback={<Skeleton className="h-[420px] w-full rounded-2xl" />}>
              <DashboardTrends year={refYear} month={refMonth} />
            </Suspense>
          </div>

          {/* Row 2B — Project utilization. Current-snapshot ("now"), not re-anchored
              to the reference month — it's utilization, not a monthly KPI. */}
          <div className="lg:col-span-4">
            <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
              <DashboardUtilization today={todayUTC} />
            </Suspense>
          </div>

          {/* Row 3A — Workforce composition. Also a current snapshot. */}
          <div className="lg:col-span-7">
            <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
              <DashboardWorkforceComposition today={todayUTC} />
            </Suspense>
          </div>

          {/* Row 3B — "Today" pulse card: Present/On-leave today (moved out of the
              KPI cluster, honesty logic + hrefs unchanged) + quick links as slim rows
              (replaces the old 4 huge bottom cards). */}
          <div className="lg:col-span-5">
            <Card className="h-full">
              <CardHeader title="Today" subtitle={todayHasRows ? `${presentToday} present · ${onLeaveToday} on leave` : "Attendance not marked yet"} />
              <CardBody className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href={`/hr/attendance?year=${todayY}&month=${todayM}`}
                    className="group rounded-xl bg-emerald-50/60 p-3 motion-safe:transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                      <CalendarCheck className="h-3.5 w-3.5" />
                      Present today
                    </div>
                    <div className="nums mt-1.5 text-2xl font-semibold leading-none text-slate-900">
                      <span className={todayHasRows ? undefined : "text-slate-300"}>{todayHasRows ? presentToday : "—"}</span>
                    </div>
                    {!todayHasRows && <p className="mt-1 text-[11px] text-slate-500">Not marked yet</p>}
                  </Link>
                  <Link
                    href={`/hr/attendance?year=${todayY}&month=${todayM}`}
                    className="group rounded-xl bg-amber-50/60 p-3 motion-safe:transition hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
                      <Clock className="h-3.5 w-3.5" />
                      On leave today
                    </div>
                    <div className="nums mt-1.5 text-2xl font-semibold leading-none text-slate-900">
                      <span className={todayHasRows ? undefined : "text-slate-300"}>{todayHasRows ? onLeaveToday : "—"}</span>
                    </div>
                    {!todayHasRows && <p className="mt-1 text-[11px] text-slate-500">Not marked yet</p>}
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
                  {quickLinks.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="group flex min-h-11 items-center gap-2 rounded-lg px-2 motion-safe:transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 motion-safe:transition group-hover:bg-brand-100">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700">{label}</span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-brand-500" />
                    </Link>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-400">&quot;Projected&quot; values are least-squares trend extrapolations, not guarantees · {netPayrollMonth ? `${fmtINR(netPayrollMonth)} processed ${isCurrentRefMonth ? "this month" : `in ${cur.label} ${refYear}`}` : `no payroll processed ${isCurrentRefMonth ? "yet this month" : `in ${cur.label} ${refYear}`}`}</p>
      </div>
    </>
  );
}
