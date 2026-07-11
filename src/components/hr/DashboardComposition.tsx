import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, EntityLink, cn } from "@/components/ui";
import { fmtDateOnly } from "@/lib/format";
import { buildQuery } from "@/lib/hr-filters";
import { EMP_CATEGORIES, DEPARTMENTS } from "@/lib/hr-validation";

// The HR dashboard's streamed cells (each its own Suspense boundary). Every cell
// re-runs its own slice of the employee/project/attendance queries rather than
// sharing another cell's result — correctness over dedupe.
//
// Density is the point of this screen (client requirement: everything visible on
// one screen in small boxes), so the cells compose their own compact tile/box
// chrome instead of the roomier StatCard/CardHeader/CardBody primitives.

/* ── Compact building blocks ───────────────────────────────────────────────── */

function KpiTile({
  label,
  value,
  dot,
  href,
}: {
  label: string;
  value: React.ReactNode;
  dot: string; // tailwind bg-* class for the tone dot
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} aria-hidden="true" />
        <span className="truncate text-[11px] font-medium text-slate-500">{label}</span>
      </div>
      <div className="nums mt-1 text-lg font-semibold leading-none text-slate-900">{value}</div>
    </>
  );
  const base = "min-w-0 rounded-xl bg-white px-3 py-2 shadow-[var(--shadow-card)]";
  return href ? (
    <Link
      href={href}
      className={cn(base, "lift block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40")}
    >
      {inner}
    </Link>
  ) : (
    <div className={base}>{inner}</div>
  );
}

// Slim card shell: 40px header + a capped, internally-scrolling body so the
// three boxes never push the page past one screen no matter how long the lists.
function Box({
  title,
  meta,
  action,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex h-full min-w-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <h2 className="flex min-w-0 items-baseline gap-2 text-sm font-semibold tracking-tight text-slate-900">
          <span className="truncate">{title}</span>
          {meta && <span className="nums shrink-0 text-[11px] font-medium text-slate-400">{meta}</span>}
        </h2>
        {action}
      </div>
      <div className="max-h-80 min-h-0 flex-1 overflow-y-auto px-4 py-2.5">{children}</div>
    </Card>
  );
}

function BoxLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="press inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-brand-700 transition-colors hover:text-brand"
    >
      {children}
      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}

function BoxEmpty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex h-full min-h-24 flex-col items-center justify-center gap-1 py-6 text-center">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint && <p className="max-w-60 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/* ── KPI strip: total + today's attendance + per-category headcount ───────── */
// Every known employment category renders even at 0 (the client's ask is the
// full category split — On-Roll / Contract / Outsourced / …), with legacy or
// custom category values appended after the presets.
export async function ManpowerKpis({ todayUTC }: { todayUTC: Date }) {
  const [byCategory, attToday] = await Promise.all([
    prisma.employee.groupBy({ by: ["empCategory"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.attendanceRecord.groupBy({ by: ["status"], where: { date: todayUTC }, _count: { _all: true } }),
  ]);
  const total = byCategory.reduce((s, r) => s + r._count._all, 0);

  const catCount = new Map<string, number>();
  for (const r of byCategory) {
    const key = r.empCategory?.trim() || "Uncategorised";
    catCount.set(key, (catCount.get(key) ?? 0) + r._count._all);
  }
  const presets: readonly string[] = EMP_CATEGORIES;
  const catHref = (c: string) => buildQuery("/hr/employees", { status: "ACTIVE", category: c });
  const categories = [
    ...EMP_CATEGORIES.map((c) => ({ label: c, value: catCount.get(c) ?? 0, href: catHref(c) })),
    ...[...catCount.entries()]
      .filter(([label]) => label !== "Uncategorised" && !presets.includes(label))
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, href: catHref(label) })),
    ...(catCount.has("Uncategorised")
      ? [{ label: "Uncategorised", value: catCount.get("Uncategorised")!, href: undefined }]
      : []),
  ];

  const n = (s: string) => attToday.find((r) => r.status === s)?._count._all ?? 0;
  const presentToday = n("PRESENT");
  const onLeaveToday = n("LEAVE") + n("SICK");
  // Honesty rule: zero rows today → "—", never an alarming 0.
  const todayHasRows = attToday.reduce((s, r) => s + r._count._all, 0) > 0;
  const y = todayUTC.getUTCFullYear();
  const m = todayUTC.getUTCMonth() + 1;
  const attendanceHref = `/hr/attendance?year=${y}&month=${m}`;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
      <KpiTile label="Total manpower" value={total} dot="bg-brand-500" href="/hr/employees?status=ACTIVE" />
      <KpiTile label="Present today" value={todayHasRows ? presentToday : "—"} dot="bg-emerald-500" href={attendanceHref} />
      <KpiTile label="On leave today" value={todayHasRows ? onLeaveToday : "—"} dot="bg-amber-500" href={attendanceHref} />
      {categories.map((c) => (
        <KpiTile key={c.label} label={c.label} value={c.value} dot="bg-slate-300" href={c.href} />
      ))}
    </div>
  );
}

/* ── Manpower by department ────────────────────────────────────────────────── */
// One slim bar-row per department. Preset departments always render (zeros
// included) so the box reads as the org structure, not just whoever has the
// field filled in; departments with headcount sort first.
export async function DashboardDepartments() {
  const byDept = await prisma.employee.groupBy({
    by: ["department"],
    where: { status: "ACTIVE" },
    _count: { _all: true },
  });

  const deptCount = new Map<string, number>();
  for (const r of byDept) {
    const key = r.department?.trim() || "Unassigned";
    deptCount.set(key, (deptCount.get(key) ?? 0) + r._count._all);
  }
  const staffed = [...deptCount.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const empty = DEPARTMENTS.filter((d) => !deptCount.has(d)).map((d) => ({ label: d, value: 0 }));
  const items = [...staffed, ...empty];
  const max = Math.max(1, ...items.map((i) => i.value));
  const totalActive = staffed.reduce((s, i) => s + i.value, 0);

  return (
    <Box
      title="By department"
      meta={`${totalActive} active`}
      action={<BoxLink href="/hr/employees?status=ACTIVE">Employees</BoxLink>}
    >
      <ul>
        {items.map((d) => {
          const zero = d.value === 0;
          const row = (
            <>
              <span className={cn("w-[42%] truncate text-xs", zero ? "text-slate-400" : "text-slate-600")}>
                {d.label}
              </span>
              <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                {!zero && (
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300"
                    style={{ width: `${Math.min(100, (d.value / max) * 100)}%` }}
                  />
                )}
              </span>
              <span className={cn("nums w-7 shrink-0 text-right text-xs font-semibold", zero ? "text-slate-400" : "text-slate-700")}>
                {d.value}
              </span>
            </>
          );
          // "Unassigned" has no department value to filter by — leave it unlinked.
          return (
            <li key={d.label}>
              {d.label === "Unassigned" ? (
                <div className="-mx-1.5 flex items-center gap-2.5 rounded-lg px-1.5 py-[5px]">{row}</div>
              ) : (
                <Link
                  href={buildQuery("/hr/employees", { status: "ACTIVE", department: d.label })}
                  className="-mx-1.5 flex items-center gap-2.5 rounded-lg px-1.5 py-[5px] motion-safe:transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                >
                  {row}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Box>
  );
}

/* ── Project-wise manpower ─────────────────────────────────────────────────── */
// Active projects ranked by staffed headcount, plus the deployed/bench split
// (working = distinct active employees on a live assignment, bench = active
// headcount minus that). Each project row deep-links to its page. No status
// chip on rows — the query already filters to ACTIVE, so it carries no signal.
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

  const summary = [
    { label: "Live projects", value: projects.length, cls: "bg-brand-50/60 text-brand-700" },
    { label: "On projects", value: deployed, cls: "bg-emerald-50/60 text-emerald-700" },
    { label: "Not deployed", value: bench, cls: "bg-amber-50/60 text-amber-700" },
  ];

  return (
    <Box title="By project" meta={`${projects.length} live`} action={<BoxLink href="/hr/projects">Projects</BoxLink>}>
      <div className="grid grid-cols-3 gap-1.5">
        {summary.map((s) => (
          <div key={s.label} className={cn("min-w-0 rounded-lg px-2.5 py-1.5", s.cls)}>
            <div className="nums text-base font-semibold leading-none text-slate-900">{s.value}</div>
            <div className="mt-0.5 truncate text-[11px] font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 border-t border-slate-100 pt-1.5">
        {ranked.length === 0 ? (
          <BoxEmpty title="No active projects" hint="Staffing per project appears once a project is live." />
        ) : (
          <ul>
            {ranked.map((p) => {
              const range = [fmtDateOnly(p.startDate), fmtDateOnly(p.endDate)].filter(Boolean).join(" – ");
              return (
                <li key={p.id}>
                  <Link
                    href={`/hr/projects/${p.id}`}
                    className="group -mx-1.5 flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 motion-safe:transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="truncate text-[13px] font-medium text-slate-800 group-hover:text-brand-700">
                          {p.name}
                        </span>
                        <span className="nums shrink-0 font-mono text-[10px] text-slate-400">{p.code}</span>
                      </div>
                      <div className="truncate text-[11px] text-slate-500">
                        {p.client || "—"}
                        {range && <span className="nums"> · {range}</span>}
                      </div>
                    </div>
                    <span className="nums flex shrink-0 items-baseline gap-1 text-sm font-semibold text-slate-700">
                      {p._count.assignments}
                      <span className="text-[10px] font-normal text-slate-400">staff</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Box>
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
    <Box
      title="Not deployed"
      meta={`${notDeployed.length} idle`}
      action={<BoxLink href="/hr/projects">Assign</BoxLink>}
    >
      {notDeployed.length === 0 ? (
        <BoxEmpty title="Everyone is deployed" hint="Every active employee has a live project assignment." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {notDeployed.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 py-1.5">
              <EntityLink href={`/hr/employees/${e.id}`} name={e.name} code={e.empId} />
              <span className="shrink-0 text-right text-[11px] text-slate-400">
                {[e.designation, e.department].filter(Boolean).join(" · ") || "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Box>
  );
}
