"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck2, Eraser, Search, Users } from "lucide-react";
import { Button, EmptyState, EntityLink, StatCard, cn } from "@/components/ui";
import { toast } from "@/components/Toast";
import { ATTENDANCE_STATUSES, type AttendanceStatusValue } from "@/lib/hr-validation";
import { STATUS, WD } from "./attendance-status";
import AttendanceCalendar from "./AttendanceCalendar";
import Segmented from "@/components/Segmented";
import { TableScroll } from "@/components/DataTable";

type Brush = AttendanceStatusValue | "ERASE";
type Cell = AttendanceStatusValue | "";
type Emp = { id: string; empId: string; name: string };
type ViewMode = "calendar" | "table";

export default function AttendanceGrid({
  employees,
  initial,
  year,
  month,
  daysInMonth,
  canWrite,
}: {
  employees: Emp[];
  initial: { employeeId: string; day: number; status: AttendanceStatusValue }[];
  year: number;
  month: number;
  daysInMonth: number;
  canWrite: boolean;
}) {
  const router = useRouter();
  const key = (emp: string, day: number) => `${emp}:${day}`;

  // Track the server snapshot (not a frozen mount-time copy) so a record created
  // earlier this session can still be cleared after router.refresh() reloads it.
  const initialKeys = useMemo(() => new Set(initial.map((r) => key(r.employeeId, r.day))), [initial]);
  const initialGrid = useMemo(() => {
    const g: Record<string, Cell> = {};
    for (const r of initial) g[key(r.employeeId, r.day)] = r.status;
    return g;
  }, [initial]);

  const [grid, setGrid] = useState<Record<string, Cell>>(initialGrid);
  const [brush, setBrush] = useState<Brush>("PRESENT");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<Cell | null>(null);

  const [selectedEmp, setSelectedEmp] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("calendar");

  // Day metadata (weekday / weekend / today) — UTC to match stored dates.
  const days = useMemo(() => {
    const now = new Date();
    const tY = now.getUTCFullYear(), tM = now.getUTCMonth() + 1, tD = now.getUTCDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
      return { d, dow, weekend: dow === 0 || dow === 6, today: tY === year && tM === month && tD === d };
    });
  }, [year, month, daysInMonth]);

  const dirtyCount = useMemo(() => {
    let n = 0;
    const seen = new Set<string>();
    for (const emp of employees) for (const { d } of days) {
      const k = key(emp.id, d);
      seen.add(k);
      if ((grid[k] ?? "") !== (initialGrid[k] ?? "")) n++;
    }
    return n;
  }, [grid, initialGrid, employees, days]);

  // Drag-to-paint: pointerup anywhere ends the stroke.
  useEffect(() => {
    const up = () => { dragRef.current = null; };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  // Unsaved-changes navigation guard — active ONLY while dirtyCount > 0,
  // removed on save/discard (dirtyCount back to 0) or unmount. Two layers:
  // (1) `beforeunload` covers hard nav (typed URL, refresh, tab close) — the
  // browser shows its own generic prompt, `returnValue` is legacy-required.
  // (2) A capture-phase `document` click listener covers in-app `<Link>`
  // navigations (month Prev/Next, MonthPicker, ScopedFilterChip "Clear",
  // sidebar/breadcrumbs, …) that a server-rendered page header can't see
  // `dirtyCount` to guard itself. It walks up to the nearest `<a href>`,
  // skips new-tab/download/hash/external targets, and — for a same-origin
  // navigation — shows a native `confirm()`. Declining calls
  // `preventDefault()` in the CAPTURE phase, which runs before Next.js
  // Link's own bubble-phase click handler; Link bails out when it sees
  // `event.defaultPrevented`, so the router never navigates.
  // Known gap: the browser Back/Forward buttons don't fire a click (or, for
  // client-side App Router transitions, `beforeunload`), so they aren't
  // covered — that would need a `popstate` handler with its own history
  // gymnastics, out of scope for this pragmatic guard.
  useEffect(() => {
    if (dirtyCount === 0) return;

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }

    function onClickCapture(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return; // new tab/window — nothing lost here
      if (anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href") || "";
      if (!href || href.startsWith("#")) return;
      let url: URL;
      try { url = new URL(anchor.href); } catch { return; }
      if (url.origin !== window.location.origin) return; // external link — leaving the app anyway

      const ok = window.confirm(
        `You have ${dirtyCount} unsaved attendance change${dirtyCount === 1 ? "" : "s"}. Leave without saving?`
      );
      if (!ok) e.preventDefault();
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [dirtyCount]);

  function write(empId: string, day: number, value: Cell) {
    setGrid((g) => {
      const k = key(empId, day);
      if ((g[k] ?? "") === value) return g;
      return { ...g, [k]: value };
    });
  }
  function cellDown(empId: string, day: number) {
    if (!canWrite) return;
    const cur = grid[key(empId, day)] ?? "";
    const eff: Cell = brush === "ERASE" ? "" : brush;
    const value: Cell = cur === eff ? "" : eff; // click the same status again to clear
    dragRef.current = value;
    write(empId, day, value);
  }
  function cellEnter(empId: string, day: number) {
    if (!canWrite || dragRef.current === null) return;
    write(empId, day, dragRef.current);
  }

  const discard = () => setGrid(initialGrid);

  async function save() {
    setBusy(true);
    const entries = Object.entries(grid)
      .filter(([, s]) => s !== "")
      .map(([k, s]) => { const [employeeId, day] = k.split(":"); return { employeeId, day: Number(day), status: s as AttendanceStatusValue }; });
    const clears = [...initialKeys]
      .filter((k) => (grid[k] ?? "") === "")
      .map((k) => { const [employeeId, day] = k.split(":"); return { employeeId, day: Number(day) }; });
    try {
      const res = await fetch("/api/hr/attendance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, entries, clears }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Save failed");
      toast("Attendance saved", "success");
      router.refresh();
    } catch { toast("Could not save attendance.", "error"); }
    finally { setBusy(false); }
  }

  const pillEmployees = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.name.toLowerCase().includes(q) || e.empId.toLowerCase().includes(q));
  }, [employees, query]);

  // The grid shows only the selected employee (no scrolling) — but search takes
  // precedence: if the query excludes the pinned employee, fall through to the
  // search results (and the empty state) rather than stranding the selection.
  const filtered = useMemo(() => {
    if (selectedEmp) {
      const one = pillEmployees.find((e) => e.id === selectedEmp);
      if (one) return [one];
    }
    return pillEmployees;
  }, [pillEmployees, selectedEmp]);

  // Table-mode only: click a day column header to apply the current brush to
  // that day for every currently-shown (filtered) employee — a fast path for
  // marking a HOLIDAY/WEEK_OFF across the whole roster at once.
  function fillDay(day: number) {
    if (!canWrite) return;
    const eff: Cell = brush === "ERASE" ? "" : brush;
    setGrid((g) => {
      const next = { ...g };
      for (const emp of filtered) next[key(emp.id, day)] = eff;
      return next;
    });
  }

  // Totals across all employees for the stat strip. `unmarked` only counts
  // ELAPSED WORKING days — weekends never count, and (for the current month)
  // days after today don't either: a past month counts every non-weekend
  // day, a future month counts zero (nothing has "elapsed" yet).
  const totals = useMemo(() => {
    const now = new Date();
    const tY = now.getUTCFullYear(), tM = now.getUTCMonth() + 1, tD = now.getUTCDate();
    const isFutureMonth = year > tY || (year === tY && month > tM);
    const isPastMonth = year < tY || (year === tY && month < tM);
    const elapsedThrough = isFutureMonth ? 0 : isPastMonth ? daysInMonth : Math.min(daysInMonth, tD);

    let present = 0, absent = 0, leave = 0, unmarked = 0;
    for (const emp of employees) for (const { d, weekend } of days) {
      const s = grid[key(emp.id, d)] ?? "";
      if (s === "PRESENT") present++;
      else if (s === "ABSENT") absent++;
      else if (s === "LEAVE" || s === "SICK") leave++;
      if (!s && !weekend && d <= elapsedThrough) unmarked++;
    }
    return { present, absent, leave, unmarked };
  }, [grid, employees, days, year, month, daysInMonth]);

  const tally = (empId: string, s: AttendanceStatusValue) =>
    days.reduce((n, { d }) => n + (grid[key(empId, d)] === s ? 1 : 0), 0);

  // All 7 statuses, tinted per STATUS[s] (falls back to a neutral chip at 0).
  function renderTally(empId: string) {
    return ATTENDANCE_STATUSES.map((s) => {
      const n = tally(empId, s);
      return (
        <span
          key={s}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium",
            n ? STATUS[s].cell : "bg-slate-50 text-slate-400"
          )}
        >
          <span className="nums font-semibold">{n}</span> {STATUS[s].label}
        </span>
      );
    });
  }

  function calendarCells(empId: string): Record<number, Cell> {
    const out: Record<number, Cell> = {};
    for (const { d } of days) out[d] = grid[key(empId, d)] ?? "";
    return out;
  }

  const BRUSHES: Brush[] = [...ATTENDANCE_STATUSES, "ERASE"];

  // Calendar mode shows one big paintable month for a single employee when
  // either they're explicitly pinned via the filter pills, or the roster
  // itself is scoped to exactly one employee (e.g. /hr/attendance?employeeId=…).
  const singleEmp: Emp | null =
    filtered.length === 1 && (selectedEmp === filtered[0].id || employees.length === 1)
      ? filtered[0]
      : null;

  return (
    <div className="space-y-5">
      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Employees" value={employees.length} icon={<Users className="h-4 w-4" />} tone="brand" />
        <StatCard label="Present days" value={totals.present} icon={<CalendarCheck2 className="h-4 w-4" />} tone="emerald" />
        <StatCard label="Absent days" value={totals.absent} tone="rose" />
        <StatCard label="Unmarked" value={totals.unmarked} tone="slate" />
      </div>

      {/* Toolbar: legend/brush picker + view toggle + search */}
      <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {canWrite ? (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Attendance status brush">
              {BRUSHES.map((b) => {
                const active = brush === b;
                const isErase = b === "ERASE";
                const meta = b === "ERASE" ? null : STATUS[b];
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBrush(b)}
                    aria-pressed={active}
                    title={isErase ? "Erase" : `${meta!.label} (${meta!.code})`}
                    className={cn(
                      "press inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      active ? "border-brand-300 bg-brand-50 text-brand-800 ring-1 ring-brand-200" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {isErase ? (
                      <Eraser className="h-3.5 w-3.5 text-slate-400" />
                    ) : (
                      <span className={cn("grid h-4 w-4 place-items-center rounded text-[10px] font-bold text-white", meta!.swatch)}>{meta!.code}</span>
                    )}
                    <span>{isErase ? "Erase" : meta!.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2" aria-label="Attendance status legend">
              {ATTENDANCE_STATUSES.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600"
                >
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", STATUS[s].swatch)} aria-hidden="true" />
                  {STATUS[s].label}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              ariaLabel="Attendance view"
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: "calendar", label: "Calendar" },
                { value: "table", label: "Table" },
              ]}
            />
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employee…"
                className="h-9 w-44 rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/20"
              />
            </div>
          </div>
        </div>

        {canWrite && (
          <p className="mt-3 text-xs text-slate-500">
            Pick a status, then <span className="font-medium text-slate-600">click or drag</span> across days to mark it. Click a cell again to clear it.
            {view === "table" && " Click a day column header to fill that day for every employee shown."}
          </p>
        )}
      </div>

      {/* Filter pills — click an employee to view only their row (no scrolling).
          Stays visible while an employee is pinned so the "All" reset never vanishes. */}
      {(pillEmployees.length > 1 || selectedEmp) && (
        <div className="sticky top-16 z-10 -mx-1 flex gap-1.5 overflow-x-auto rounded-2xl bg-white/90 px-1 py-2 shadow-[var(--shadow-card)] backdrop-blur">
          <button
            type="button"
            onClick={() => setSelectedEmp(null)}
            aria-pressed={selectedEmp === null}
            className={cn(
              "press shrink-0 rounded-full border px-3 py-1 text-xs font-medium motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
              selectedEmp === null
                ? "border-brand-300 bg-brand-50 text-brand-800 ring-1 ring-brand-200"
                : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
            )}
          >
            All <span className="nums">{employees.length}</span>
          </button>
          {pillEmployees.map((emp) => {
            const active = selectedEmp === emp.id;
            return (
              <button
                key={emp.id}
                type="button"
                onClick={() => setSelectedEmp(active ? null : emp.id)}
                title={emp.name}
                aria-pressed={active}
                className={cn(
                  "press shrink-0 rounded-full border px-3 py-1 text-xs font-medium motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                  active
                    ? "border-brand-300 bg-brand-50 text-brand-800 ring-1 ring-brand-200"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                )}
              >
                <span className="nums text-slate-400">{emp.empId}</span> {emp.name.split(" ")[0]}
              </button>
            );
          })}
        </div>
      )}

      {/* Main content: empty state, calendar heatmap, or the table matrix */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="No employees match your search"
            description={query ? `No results for “${query}”.` : "Try a different name or employee ID."}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setQuery(""); setSelectedEmp(null); }}
              >
                Clear search
              </Button>
            }
          />
        </div>
      ) : view === "calendar" ? (
        singleEmp ? (
          <div className="rounded-2xl bg-white p-3 shadow-[var(--shadow-card)] sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <EntityLink href={`/hr/employees/${singleEmp.id}`} name={singleEmp.name} code={singleEmp.empId} />
              {employees.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedEmp(null)}>
                  <Users className="h-3.5 w-3.5" /> All employees
                </Button>
              )}
            </div>
            <AttendanceCalendar
              year={year}
              month={month}
              daysInMonth={daysInMonth}
              cells={calendarCells(singleEmp.id)}
              canWrite={canWrite}
              onCellDown={(d) => cellDown(singleEmp.id, d)}
              onCellEnter={(d) => cellEnter(singleEmp.id, d)}
            />
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {renderTally(singleEmp.id)}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((emp) => (
              <div
                key={emp.id}
                className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[var(--shadow-card)] motion-safe:transition-colors hover:border-brand-200"
              >
                <div className="mb-2">
                  <EntityLink href={`/hr/employees/${emp.id}`} name={emp.name} code={emp.empId} className="text-xs" />
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEmp(emp.id)}
                  aria-label={`Focus ${emp.name}'s attendance calendar`}
                  className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  <AttendanceCalendar
                    year={year}
                    month={month}
                    daysInMonth={daysInMonth}
                    cells={calendarCells(emp.id)}
                    compact
                  />
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          {/* Per-employee summary — appears when a single employee is in focus */}
          {singleEmp && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
              <EntityLink href={`/hr/employees/${singleEmp.id}`} name={singleEmp.name} code={singleEmp.empId} className="mr-1" />
              {renderTally(singleEmp.id)}
            </div>
          )}

          <TableScroll ariaLabel="Attendance grid">
            <table className="min-w-max border-collapse text-xs select-none">
              <thead>
                <tr className="border-b border-slate-200">
                  <th scope="col" className="sticky left-0 z-10 bg-slate-50/80 px-4 py-2 text-left font-semibold uppercase tracking-wide text-slate-500">Employee</th>
                  {days.map(({ d, dow, weekend, today }) => {
                    const headerContent = (
                      <>
                        <div className="leading-none">{WD[dow]}</div>
                        <div className={cn("nums mt-0.5 leading-none", today ? "mx-auto grid h-5 w-5 place-items-center rounded-full bg-brand text-white" : "text-slate-600")}>{d}</div>
                      </>
                    );
                    return (
                      <th key={d} scope="col" className={cn("w-9 px-0 py-1.5 text-center font-medium", weekend ? "bg-slate-50 text-slate-400" : "text-slate-400")}>
                        {canWrite ? (
                          <button
                            type="button"
                            onClick={() => fillDay(d)}
                            title="Fill this day for every employee shown with the current brush"
                            aria-label={`Fill day ${d} for all shown employees with ${brush === "ERASE" ? "erase" : STATUS[brush].label}`}
                            className="w-full cursor-pointer rounded-md motion-safe:transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                          >
                            {headerContent}
                          </button>
                        ) : (
                          headerContent
                        )}
                      </th>
                    );
                  })}
                  {(["PRESENT", "HALF_DAY", "LEAVE", "ABSENT"] as const).map((s) => (
                    <th key={s} scope="col" className={cn("px-2 py-2 text-center font-bold", STATUS[s].text)} title={STATUS[s].label}>{STATUS[s].code}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => (
                  <tr
                    key={emp.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/40 motion-safe:transition-colors"
                  >
                    <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-1.5 text-left font-medium text-slate-800 whitespace-nowrap group-hover:bg-slate-50">
                      <span><span className="nums text-slate-400">{emp.empId}</span> {emp.name}</span>
                    </th>
                    {days.map(({ d, weekend }) => {
                      const s = grid[key(emp.id, d)] ?? "";
                      return (
                        <td key={d} className={cn("px-0.5 py-1 text-center", weekend && "bg-slate-50/70")}>
                          <button
                            type="button"
                            onPointerDown={() => cellDown(emp.id, d)}
                            onPointerEnter={() => cellEnter(emp.id, d)}
                            disabled={!canWrite}
                            aria-label={`Day ${d}: ${s ? STATUS[s].label : "unmarked"}`}
                            className={cn(
                              "mx-auto grid h-8 w-8 place-items-center rounded-md text-[11px] font-bold transition-colors",
                              s ? STATUS[s].cell : "text-slate-300",
                              canWrite ? "cursor-pointer hover:ring-1 hover:ring-brand-200" : "cursor-default",
                              !s && !weekend && "hover:bg-slate-100"
                            )}
                          >
                            {s ? STATUS[s].code : <span className="text-slate-200">·</span>}
                          </button>
                        </td>
                      );
                    })}
                    {(["PRESENT", "HALF_DAY", "LEAVE", "ABSENT"] as const).map((s) => {
                      const n = tally(emp.id, s);
                      return (
                        <td key={s} className={cn("nums px-2 text-center font-semibold", n ? STATUS[s].text : "text-slate-300")}>{n}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </>
      )}

      {/* Sticky save bar */}
      {canWrite && (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-[var(--shadow-pop)] backdrop-blur">
          <span className="text-sm text-slate-500">
            {dirtyCount > 0 ? <><span className="font-semibold text-slate-800">{dirtyCount}</span> unsaved change{dirtyCount === 1 ? "" : "s"}</> : "All changes saved"}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={discard} disabled={dirtyCount === 0 || busy}>Discard</Button>
            <Button size="sm" onClick={save} disabled={dirtyCount === 0 || busy}>{busy ? "Saving…" : "Save attendance"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
