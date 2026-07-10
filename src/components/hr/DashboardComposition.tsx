import Link from "next/link";
import { FolderKanban, Users, ChevronRight, Armchair, CalendarCheck, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardBody, EmptyState, StatusChip, StatCard, EntityLink, cn } from "@/components/ui";
import { fmtDateOnly } from "@/lib/format";
import { buildQuery } from "@/lib/hr-filters";
import { BarList } from "@/components/Charts";

// The HR dashboard's streamed cells (each its own Suspense boundary). Every cell
// re-runs its own slice of the employee/project/attendance queries rather than
// sharing another cell's result — correctness over dedupe.

/* ── KPI strip: total + today's attendance + per-category headcount ───────── */
export async function ManpowerKpis({ todayUTC }: { todayUTC: Date }) {
  const [byCategory, attToday] = await Promise.all([
    prisma.employee.groupBy({ by: ["empCategory"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.attendanceRecord.groupBy({ by: ["status"], where: { date: todayUTC }, _count: { _all: true } }),
  ]);
  const total = byCategory.reduce((s, r) => s + r._count._all, 0);
  const cats = [...byCategory].sort((a, b) => b._count._all - a._count._all);
  const n = (s: string) => attToday.find((r) => r.status === s)?._count._all ?? 0;
  const presentToday = n("PRESENT");
  const onLeaveToday = n("LEAVE") + n("SICK");
  // Honesty rule: zero rows today → "—", never an alarming 0.
  const todayHasRows = attToday.reduce((s, r) => s + r._count._all, 0) > 0;
  const y = todayUTC.getUTCFullYear();
  const m = todayUTC.getUTCMonth() + 1;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard size="sm" label="Total manpower" value={total} tone="brand" icon={<Users className="h-4 w-4" />} href="/hr/employees?status=ACTIVE" />
      <StatCard size="sm" label="Present today" value={todayHasRows ? presentToday : "—"} tone="emerald" icon={<CalendarCheck className="h-4 w-4" />} href={`/hr/attendance?year=${y}&month=${m}`} />
      <StatCard size="sm" label="On leave today" value={todayHasRows ? onLeaveToday : "—"} tone="amber" icon={<Clock className="h-4 w-4" />} href={`/hr/attendance?year=${y}&month=${m}`} />
      {cats.map((c) => (
        <StatCard
          key={c.empCategory ?? "uncategorised"}
          size="sm"
          label={c.empCategory ?? "Uncategorised"}
          value={c._count._all}
          tone="slate"
          href={c.empCategory ? buildQuery("/hr/employees", { status: "ACTIVE", category: c.empCategory }) : undefined}
        />
      ))}
    </div>
  );
}

/* ── Manpower by department ────────────────────────────────────────────────── */
export async function DashboardDepartments() {
  const byDept = await prisma.employee.groupBy({
    by: ["department"],
    where: { status: "ACTIVE" },
    _count: { _all: true },
  });
  const items = [...byDept]
    .sort((a, b) => b._count._all - a._count._all)
    .map((d) => ({
      label: d.department ?? "Unassigned",
      value: d._count._all,
      href: d.department
        ? buildQuery("/hr/employees", { status: "ACTIVE", department: d.department })
        : undefined,
    }));

  return (
    <Card className="h-full">
      <CardHeader
        title="By department"
        subtitle="Active headcount"
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
        {items.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No active employees"
            description="Department headcount appears once employees are on record."
          />
        ) : (
          <BarList items={items} />
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
    { label: "Not deployed", value: bench, tone: "amber" as const, icon: Armchair },
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

/* ── Not deployed to any project ───────────────────────────────────────────── */
// ACTIVE employees with no live assignment (start ≤ today, not ended) on an
// ACTIVE project — the actionable "who can be staffed" list.
export async function DashboardNotDeployed({ today }: { today: Date }) {
  const notDeployed = await prisma.employee.findMany({
    where: {
      status: "ACTIVE",
      projectAssignments: {
        none: {
          startDate: { lte: today },
          OR: [{ endDate: null }, { endDate: { gte: today } }],
          project: { status: "ACTIVE" },
        },
      },
    },
    select: { id: true, empId: true, name: true, designation: true, department: true },
    orderBy: { name: "asc" },
  });

  return (
    <Card className="h-full">
      <CardHeader
        title="Not deployed"
        subtitle={`${notDeployed.length} without a live project`}
      />
      <CardBody className="max-h-96 overflow-y-auto px-6 py-4">
        {notDeployed.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="Everyone is deployed"
            description="Every active employee has a live project assignment."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {notDeployed.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                <EntityLink href={`/hr/employees/${e.id}`} name={e.name} code={e.empId} />
                <span className="shrink-0 text-right text-xs text-slate-400">
                  {[e.designation, e.department].filter(Boolean).join(" · ") || "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
