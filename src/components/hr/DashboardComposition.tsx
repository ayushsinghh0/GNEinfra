import Link from "next/link";
import { FolderKanban, Users, ChevronRight, Armchair, CalendarCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardBody, ProgressBar, EmptyState, StatusChip, cn } from "@/components/ui";
import { fmtDateOnly } from "@/lib/format";
import CompositionBoard from "@/components/hr/CompositionBoard";

type Bar = { label: string; count: number; href?: string };

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The HR dashboard's streamed cells (each its own Suspense boundary). Every cell
// re-runs its own slice of the employee/project/attendance queries rather than
// sharing another cell's result — correctness over dedupe. Headcount is
// re-anchored to the dashboard's reference month (its attendance rate is a
// monthly reading); Workforce composition and Project details stay a
// current-snapshot ("now"), matching their pre-rework behavior.

/* ── Headcount & attendance by department (empCategory) ───────────────────── */
// "Department" maps to the Employee `empCategory` field (there is no department
// column). Per category: active headcount + the reference month's
// present-equivalent attendance rate. Honesty rule (do NOT regress): a category
// with no attendance rows for the month reads "—" + "Not marked yet", never a
// red 0% — same guard the dashboard uses everywhere else.
export async function DashboardHeadcount({
  refYear,
  refMonth,
  isCurrentRefMonth,
}: {
  refYear: number;
  refMonth: number;
  isCurrentRefMonth: boolean;
}) {
  const start = new Date(Date.UTC(refYear, refMonth - 1, 1));
  const end = new Date(Date.UTC(refYear, refMonth, 1));
  const monthLabel = `${SHORT[refMonth - 1]} ${refYear}`;

  const byCategory = await prisma.employee.groupBy({
    by: ["empCategory"],
    where: { status: "ACTIVE" },
    _count: { _all: true },
  });
  const total = byCategory.reduce((s, r) => s + r._count._all, 0);
  // Rank departments by headcount; null category ("—") sorts in naturally.
  const cats = [...byCategory].sort((a, b) => b._count._all - a._count._all);

  // Per-category month attendance — one status groupBy each (categories are few).
  // groupBy `where` supports the relation filter, so this stays a DB aggregate.
  const stats = await Promise.all(
    cats.map((c) =>
      prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: { date: { gte: start, lt: end }, employee: { empCategory: c.empCategory } },
        _count: { _all: true },
      })
    )
  );

  const rows = cats.map((c, i) => {
    const g = stats[i];
    const n = (s: string) => g.find((r) => r.status === s)?._count._all ?? 0;
    const worked = n("PRESENT") + n("ABSENT") + n("LEAVE") + n("SICK") + n("HALF_DAY");
    const rate = worked ? Math.round(((n("PRESENT") + 0.5 * n("HALF_DAY")) / worked) * 100) : 0;
    const hasRows = g.reduce((s, r) => s + r._count._all, 0) > 0;
    return {
      label: c.empCategory ?? "—",
      count: c._count._all,
      rate,
      hasRows,
      href: c.empCategory ? `/hr/employees?category=${encodeURIComponent(c.empCategory)}` : undefined,
    };
  });

  return (
    <Card className="h-full">
      <CardHeader
        title="Headcount & attendance"
        subtitle={`By department · attendance for ${monthLabel}${isCurrentRefMonth ? " (so far)" : ""}`}
        action={
          <Link
            href="/hr/employees?status=ACTIVE"
            className="press inline-flex items-center gap-1 text-sm font-medium text-brand-700 transition-colors hover:text-brand"
          >
            Employees
            <ChevronRight className="h-4 w-4" />
          </Link>
        }
      />
      <CardBody className="px-6 py-5">
        <div className="flex items-end justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="nums text-4xl font-semibold leading-none text-slate-900">{total}</div>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              Active employees
            </div>
          </div>
          <div className="text-right">
            <div className="nums text-sm font-semibold text-slate-700">{cats.length}</div>
            <div className="text-xs text-slate-400">department{cats.length === 1 ? "" : "s"}</div>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No active employees"
            description="Department headcount and attendance appear once employees are on record."
          />
        ) : (
          <ul className="mt-3 space-y-1">
            {rows.map((r) => {
              const inner = (
                <>
                  <div className="min-w-0 flex-[1.4]">
                    <div className="truncate text-sm font-medium text-slate-700 group-hover:text-brand-700">{r.label}</div>
                    <div className="nums text-xs text-slate-400">
                      {r.count} {r.count === 1 ? "person" : "people"}
                    </div>
                  </div>
                  <div className="flex flex-1 items-center gap-2.5">
                    {r.hasRows ? (
                      <>
                        <ProgressBar value={r.rate} tone="brand" className="min-w-0 flex-1" />
                        <span className="nums w-9 shrink-0 text-right text-sm font-semibold text-slate-700">{r.rate}%</span>
                      </>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-slate-400">
                        <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        Not marked yet
                      </span>
                    )}
                  </div>
                </>
              );
              return (
                <li key={r.label}>
                  {r.href ? (
                    <Link
                      href={r.href}
                      className="group -mx-1.5 flex min-h-11 items-center gap-3 rounded-lg px-1.5 motion-safe:transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex min-h-11 items-center gap-3 px-1.5">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/* ── Project details ──────────────────────────────────────────────────────── */
// Active projects, plus the "who's deployed / who's idle" split the utilization
// card used to carry (working = distinct active employees on a live assignment,
// unused = active headcount minus that). Each project row deep-links to its page.
export async function DashboardProjects({ today }: { today: Date }) {
  // An assignment is "live" now = its employee is active AND it hasn't ended.
  const liveAssignment = {
    employee: { status: "ACTIVE" as const },
    OR: [{ endDate: null }, { endDate: { gte: today } }],
  };

  const [activeCount, projects, assigned] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.project.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        code: true,
        client: true,
        status: true,
        startDate: true,
        endDate: true,
        _count: { select: { assignments: { where: liveAssignment } } },
      },
    }),
    prisma.projectAssignment.findMany({
      where: liveAssignment,
      select: { employeeId: true },
      distinct: ["employeeId"],
    }),
  ]);

  const deployed = assigned.length;
  const bench = Math.max(0, activeCount - deployed);

  // Rank by staffed headcount — the list answers "where are people committed".
  const ranked = [...projects].sort(
    (a, b) => b._count.assignments - a._count.assignments || a.name.localeCompare(b.name)
  );
  const CAP = 6;
  const shown = ranked.slice(0, CAP);
  const moreCount = ranked.length - shown.length;

  const summary = [
    { label: "Active projects", value: projects.length, tone: "brand" as const, icon: FolderKanban },
    { label: "On projects", value: deployed, tone: "emerald" as const, icon: Users },
    { label: "Unused (bench)", value: bench, tone: "amber" as const, icon: Armchair },
  ];
  const toneCls: Record<"brand" | "emerald" | "amber", string> = {
    brand: "bg-brand-50/60 text-brand-700",
    emerald: "bg-emerald-50/60 text-emerald-700",
    amber: "bg-amber-50/60 text-amber-700",
  };

  return (
    <Card className="h-full">
      <CardHeader
        title="Project details"
        subtitle="Live projects and staffing"
        action={
          <Link
            href="/hr/projects"
            className="press inline-flex items-center gap-1 text-sm font-medium text-brand-700 transition-colors hover:text-brand"
          >
            Projects
            <ChevronRight className="h-4 w-4" />
          </Link>
        }
      />
      <CardBody className="space-y-4 px-6 py-5">
        <div className="grid grid-cols-3 gap-2.5">
          {summary.map((s) => (
            <div key={s.label} className={cn("rounded-xl p-2.5", toneCls[s.tone])}>
              <div className="flex items-center gap-1.5 text-[11px] font-medium">
                <s.icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="truncate">{s.label}</span>
              </div>
              <div className="nums mt-1 text-xl font-semibold leading-none text-slate-900">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 pt-3">
          {shown.length === 0 ? (
            <p className="text-sm text-slate-400">
              No active projects yet —{" "}
              <Link href="/hr/projects" className="font-medium text-brand-700 hover:text-brand">
                view projects
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-1">
              {shown.map((p) => {
                const range = [fmtDateOnly(p.startDate), fmtDateOnly(p.endDate)].filter(Boolean).join(" – ");
                return (
                  <li key={p.id}>
                    <Link
                      href={`/hr/projects/${p.id}`}
                      className="group -mx-1.5 flex min-h-11 items-center gap-3 rounded-lg px-1.5 py-1 motion-safe:transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-slate-800 group-hover:text-brand-700">{p.name}</span>
                          <span className="nums shrink-0 font-mono text-[11px] text-slate-400">{p.code}</span>
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {p.client || "—"}
                          {range && <span className="nums"> · {range}</span>}
                        </div>
                      </div>
                      <StatusChip status={p.status} className="hidden shrink-0 sm:inline-flex" />
                      <span className="nums flex shrink-0 items-baseline gap-1 text-sm font-semibold text-slate-700">
                        {p._count.assignments}
                        <span className="text-[11px] font-normal text-slate-400">staff</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {moreCount > 0 && (
            <Link
              href="/hr/projects"
              className="press mt-1 inline-flex items-center gap-1 px-1.5 text-xs font-medium text-brand-700 transition-colors hover:text-brand"
            >
              +{moreCount} more project{moreCount === 1 ? "" : "s"}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

/* ── Workforce composition (location/designation/category/band/tenure) ────── */
export async function DashboardWorkforceComposition({ today }: { today: Date }) {
  const [byLocation, byDesignation, byEmpCategory, byBand, joinDates] = await Promise.all([
    prisma.employee.groupBy({ by: ["location"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["designation"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["empCategory"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["band"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.employee.findMany({ where: { status: "ACTIVE" }, select: { dateOfJoining: true } }),
  ]);

  const now = today.getTime();
  const tenures = joinDates.map((e) => (now - e.dateOfJoining.getTime()) / (365.25 * 24 * 3600 * 1000));
  const tenureBars: Bar[] = [
    { label: "0–1 yr", count: tenures.filter((t) => t < 1).length },
    { label: "1–3 yrs", count: tenures.filter((t) => t >= 1 && t < 3).length },
    { label: "3+ yrs", count: tenures.filter((t) => t >= 3).length },
  ];

  // Summary: total active, average tenure (years), new joiners this calendar month.
  const totalActive = joinDates.length;
  const avgTenure = totalActive ? tenures.reduce((s, t) => s + t, 0) / totalActive : 0;
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const newJoiners = joinDates.filter((e) => e.dateOfJoining >= monthStart).length;

  const sortDesc = (a: Bar[]) => [...a].sort((x, y) => y.count - x.count);
  const locationBars = sortDesc(byLocation.map((r) => ({ label: r.location ?? "—", count: r._count._all })));
  const designationBars = sortDesc(byDesignation.map((r) => ({ label: r.designation ?? "—", count: r._count._all })));
  const categoryBars = sortDesc(byEmpCategory.map((r) => ({ label: r.empCategory ?? "—", count: r._count._all })));
  const bandBars = sortDesc(byBand.map((r) => ({ label: r.band ?? "—", count: r._count._all })));

  return (
    <CompositionBoard
      location={locationBars}
      designation={designationBars}
      category={categoryBars}
      band={bandBars}
      tenure={tenureBars}
      summary={{ totalActive, avgTenure: Math.round(avgTenure * 10) / 10, newJoiners }}
    />
  );
}
