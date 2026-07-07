import Link from "next/link";
import { Suspense } from "react";
import { CalendarCheck, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { BrandHero, CanvasAtmosphere } from "@/components/chrome";
import { Skeleton, Card, CardHeader, CardBody } from "@/components/ui";
import {
  DashboardHeadcount,
  DashboardWorkforceComposition,
  DashboardProjects,
} from "@/components/hr/DashboardComposition";
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

  // Reference month (MonthPicker) — the "as-of" anchor for the department
  // attendance rates on the Headcount card. It does NOT drive the "present/on
  // leave today" pulse, which stays real-time "today" regardless of the picker.
  const sp = await searchParams;
  const refYear = Math.max(2000, Math.min(2100, Number(sp.year) || todayY));
  const refMonth = Math.max(1, Math.min(12, Number(sp.month) || todayM));
  const isCurrentRefMonth = refYear === todayY && refMonth === todayM;

  // Today pulse — cheap real-time snapshot, paints immediately (the heavier
  // cards below stream in via Suspense).
  const attTodayG = await prisma.attendanceRecord.groupBy({
    by: ["status"],
    where: { date: todayUTC },
    _count: { _all: true },
  });
  const presentToday = attTodayG.find((r) => r.status === "PRESENT")?._count._all ?? 0;
  const onLeaveToday =
    (attTodayG.find((r) => r.status === "LEAVE")?._count._all ?? 0) +
    (attTodayG.find((r) => r.status === "SICK")?._count._all ?? 0);
  // Any row at all today → distinguishes "0 present because nobody's marked yet"
  // from "0 present, and that's a real reading".
  const todayHasRows = attTodayG.reduce((s, r) => s + r._count._all, 0) > 0;

  return (
    <>
      <BrandHero
        variant="mint"
        size="sm"
        wave={false}
        eyebrow="Human Resources"
        title="HR Dashboard"
        subtitle="Workforce, attendance and projects — at a glance."
        className="px-4 pb-6 pt-8 sm:px-6"
      />
      <div className="relative isolate space-y-4 p-4 sm:p-6">
        {/* Whisper-quiet backdrop — dots/blobs live in the gutters BEHIND the
            opaque cards (see CanvasAtmosphere), never behind data itself. */}
        <CanvasAtmosphere />

        {/* Reference-month control — lives HERE, not inside BrandHero: the hero is
            `overflow-hidden` (for its wave/atmosphere), which clipped the month
            popover. In normal body flow the dropdown opens unclipped. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Viewing</span>
          <MonthPicker year={refYear} month={refMonth} basePath="/hr" />
        </div>

        {/* 12-col bento (lg+): Row 1 — Headcount + dept attendance (8) · Today
            pulse (4). Row 2 — Workforce composition (7) · Project details (5).
            Single column on mobile, same order. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
              <DashboardHeadcount refYear={refYear} refMonth={refMonth} isCurrentRefMonth={isCurrentRefMonth} />
            </Suspense>
          </div>

          {/* Today pulse — present / on-leave today, honest empty states. */}
          <div className="lg:col-span-4">
            <Card className="h-full">
              <CardHeader
                title="Today"
                subtitle={todayHasRows ? `${presentToday} present · ${onLeaveToday} on leave` : "Attendance not marked yet"}
              />
              <CardBody className="px-6 py-5">
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
              </CardBody>
            </Card>
          </div>

          <div className="lg:col-span-7">
            <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
              <DashboardWorkforceComposition today={todayUTC} />
            </Suspense>
          </div>

          <div className="lg:col-span-5">
            <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
              <DashboardProjects today={todayUTC} />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}
