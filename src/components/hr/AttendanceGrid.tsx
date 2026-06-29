"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck2, Eraser, Search, Users } from "lucide-react";
import { Button, StatCard, cn } from "@/components/ui";
import { ATTENDANCE_STATUSES, type AttendanceStatusValue } from "@/lib/hr-validation";

type Brush = AttendanceStatusValue | "ERASE";
type Cell = AttendanceStatusValue | "";
type Emp = { id: string; empId: string; name: string };

const STATUS: Record<
  AttendanceStatusValue,
  { code: string; label: string; cell: string; swatch: string; text: string }
> = {
  PRESENT: { code: "P", label: "Present", cell: "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200", swatch: "bg-emerald-500", text: "text-emerald-700" },
  ABSENT: { code: "A", label: "Absent", cell: "bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200", swatch: "bg-rose-500", text: "text-rose-700" },
  LEAVE: { code: "L", label: "Leave", cell: "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200", swatch: "bg-amber-500", text: "text-amber-700" },
  SICK: { code: "S", label: "Sick", cell: "bg-orange-100 text-orange-700 ring-1 ring-inset ring-orange-200", swatch: "bg-orange-500", text: "text-orange-700" },
  HALF_DAY: { code: "½", label: "Half-day", cell: "bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200", swatch: "bg-blue-500", text: "text-blue-700" },
  HOLIDAY: { code: "H", label: "Holiday", cell: "bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-200", swatch: "bg-violet-500", text: "text-violet-700" },
  WEEK_OFF: { code: "W", label: "Week-off", cell: "bg-slate-200 text-slate-500 ring-1 ring-inset ring-slate-300", swatch: "bg-slate-400", text: "text-slate-500" },
};

const WD = ["S", "M", "T", "W", "T", "F", "S"];

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

  const initialKeys = useState(() => new Set(initial.map((r) => key(r.employeeId, r.day))))[0];
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

  const rowRefs = useRef<Map<string, HTMLTableRowElement | null>>(new Map());
  const [flashId, setFlashId] = useState<string | null>(null);

  function jumpTo(id: string) {
    const el = rowRefs.current.get(id);
    if (!el) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    setFlashId(id);
    window.setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1600);
  }

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
      router.refresh();
    } catch { alert("Could not save attendance."); }
    finally { setBusy(false); }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.name.toLowerCase().includes(q) || e.empId.toLowerCase().includes(q));
  }, [employees, query]);

  // Totals across all employees for the stat strip.
  const totals = useMemo(() => {
    let present = 0, absent = 0, leave = 0, marked = 0;
    for (const emp of employees) for (const { d } of days) {
      const s = grid[key(emp.id, d)] ?? "";
      if (!s) continue;
      marked++;
      if (s === "PRESENT") present++;
      else if (s === "ABSENT") absent++;
      else if (s === "LEAVE" || s === "SICK") leave++;
    }
    const capacity = employees.length * days.length;
    return { present, absent, leave, unmarked: capacity - marked };
  }, [grid, employees, days]);

  const tally = (empId: string, s: AttendanceStatusValue) =>
    days.reduce((n, { d }) => n + (grid[key(empId, d)] === s ? 1 : 0), 0);

  const BRUSHES: Brush[] = [...ATTENDANCE_STATUSES, "ERASE"];

  return (
    <div className="space-y-5">
      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Employees" value={employees.length} icon={<Users className="h-4 w-4" />} tone="brand" />
        <StatCard label="Present days" value={totals.present} icon={<CalendarCheck2 className="h-4 w-4" />} tone="emerald" />
        <StatCard label="Absent days" value={totals.absent} tone="amber" />
        <StatCard label="Unmarked" value={totals.unmarked} tone="slate" />
      </div>

      {/* Toolbar: legend + brush picker + actions */}
      <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Attendance status">
            {BRUSHES.map((b) => {
              const active = brush === b;
              const isErase = b === "ERASE";
              const meta = b === "ERASE" ? null : STATUS[b];
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => canWrite && setBrush(b)}
                  disabled={!canWrite}
                  aria-pressed={active}
                  title={isErase ? "Erase" : `${meta!.label} (${meta!.code})`}
                  className={cn(
                    "press inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    active ? "border-brand-300 bg-brand-50 text-brand-800 ring-1 ring-brand-200" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    !canWrite && "cursor-default opacity-90"
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

          <div className="flex items-center gap-2">
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
          </p>
        )}
      </div>

      {/* Jump pills — click to scroll straight to an employee's row */}
      {filtered.length > 1 && (
        <div className="sticky top-16 z-10 -mx-1 flex gap-1.5 overflow-x-auto rounded-2xl bg-white/90 px-1 py-2 shadow-[var(--shadow-card)] backdrop-blur">
          {filtered.map((emp) => (
            <button
              key={emp.id}
              type="button"
              onClick={() => jumpTo(emp.id)}
              title={emp.name}
              className="press shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 motion-safe:transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <span className="nums text-slate-400">{emp.empId}</span> {emp.name.split(" ")[0]}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
        <table className="min-w-max border-collapse text-xs select-none">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="sticky left-0 z-10 bg-slate-50/80 px-4 py-2 text-left font-semibold uppercase tracking-wide text-slate-500">Employee</th>
              {days.map(({ d, dow, weekend, today }) => (
                <th key={d} className={cn("w-9 px-0 py-1.5 text-center font-medium", weekend ? "bg-slate-50 text-slate-400" : "text-slate-400")}>
                  <div className="leading-none">{WD[dow]}</div>
                  <div className={cn("nums mt-0.5 leading-none", today ? "mx-auto grid h-5 w-5 place-items-center rounded-full bg-brand text-white" : "text-slate-600")}>{d}</div>
                </th>
              ))}
              {(["PRESENT", "HALF_DAY", "LEAVE", "ABSENT"] as const).map((s) => (
                <th key={s} className={cn("px-2 py-2 text-center font-bold", STATUS[s].text)} title={STATUS[s].label}>{STATUS[s].code}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp) => (
              <tr
                key={emp.id}
                ref={(el) => { rowRefs.current.set(emp.id, el); }}
                className={cn(
                  "border-b border-slate-100 last:border-0 motion-safe:transition-colors",
                  flashId === emp.id ? "bg-brand-50" : "hover:bg-slate-50/40"
                )}
              >
                <td className="sticky left-0 z-10 bg-white px-4 py-1.5 font-medium text-slate-800 whitespace-nowrap group-hover:bg-slate-50">
                  <span><span className="nums text-slate-400">{emp.empId}</span> {emp.name}</span>
                </td>
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
        {filtered.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-400">No employees match “{query}”.</p>
        )}
      </div>

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
