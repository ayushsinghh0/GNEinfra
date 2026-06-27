"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { ATTENDANCE_STATUSES, type AttendanceStatusValue } from "@/lib/hr-validation";

const CODE: Record<AttendanceStatusValue, string> = {
  PRESENT: "P", ABSENT: "A", LEAVE: "L", HALF_DAY: "½", HOLIDAY: "H", WEEK_OFF: "W",
};
const COLOR: Record<AttendanceStatusValue, string> = {
  PRESENT: "bg-emerald-100 text-emerald-700", ABSENT: "bg-rose-100 text-rose-700",
  LEAVE: "bg-amber-100 text-amber-700", HALF_DAY: "bg-blue-100 text-blue-700",
  HOLIDAY: "bg-slate-200 text-slate-600", WEEK_OFF: "bg-slate-100 text-slate-400",
};
type Emp = { id: string; empId: string; name: string };
type Cell = AttendanceStatusValue | "";

export default function AttendanceGrid({
  employees, initial, year, month, daysInMonth, canWrite,
}: {
  employees: Emp[]; initial: { employeeId: string; day: number; status: AttendanceStatusValue }[];
  year: number; month: number; daysInMonth: number; canWrite: boolean;
}) {
  const router = useRouter();
  const key = (emp: string, day: number) => `${emp}:${day}`;
  const initialKeys = useState(() => new Set(initial.map((r) => key(r.employeeId, r.day))))[0];
  const [grid, setGrid] = useState<Record<string, Cell>>(() => {
    const g: Record<string, Cell> = {};
    for (const r of initial) g[key(r.employeeId, r.day)] = r.status;
    return g;
  });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  const cycle = (cur: Cell): Cell => {
    const order: Cell[] = ["", ...ATTENDANCE_STATUSES];
    return order[(order.indexOf(cur) + 1) % order.length];
  };
  const click = (emp: string, day: number) => {
    if (!canWrite) return;
    setGrid((g) => ({ ...g, [key(emp, day)]: cycle(g[key(emp, day)] ?? "") }));
    setDirty(true);
  };

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
      setDirty(false);
      router.refresh();
    } catch { /* surface via alert below */ alert("Could not save attendance."); }
    finally { setBusy(false); }
  }

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const tally = (emp: string, s: AttendanceStatusValue) =>
    days.filter((d) => grid[key(emp, d)] === s).length;

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Click a cell to cycle: P → A → L → ½ → H → W → blank.</p>
          <Button onClick={save} disabled={!dirty || busy}>{busy ? "Saving…" : "Save attendance"}</Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="text-xs">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-semibold text-slate-500">Employee</th>
              {days.map((d) => <th key={d} className="w-7 px-0 py-2 text-center font-medium text-slate-400">{d}</th>)}
              <th className="px-2 py-2 text-center font-semibold text-emerald-600">P</th>
              <th className="px-2 py-2 text-center font-semibold text-amber-600">L</th>
              <th className="px-2 py-2 text-center font-semibold text-rose-600">A</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className="border-b border-slate-100">
                <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium text-slate-800 whitespace-nowrap">
                  <span className="nums text-slate-400">{emp.empId}</span> {emp.name}
                </td>
                {days.map((d) => {
                  const s = grid[key(emp.id, d)] ?? "";
                  return (
                    <td key={d} className="px-0 py-1 text-center">
                      <button type="button" onClick={() => click(emp.id, d)} disabled={!canWrite}
                        className={`mx-auto grid h-6 w-6 place-items-center rounded text-[11px] font-bold ${s ? COLOR[s] : "text-slate-300 hover:bg-slate-100"} ${canWrite ? "cursor-pointer" : "cursor-default"}`}>
                        {s ? CODE[s] : "·"}
                      </button>
                    </td>
                  );
                })}
                <td className="nums px-2 text-center font-semibold text-emerald-700">{tally(emp.id, "PRESENT")}</td>
                <td className="nums px-2 text-center font-semibold text-amber-700">{tally(emp.id, "LEAVE")}</td>
                <td className="nums px-2 text-center font-semibold text-rose-700">{tally(emp.id, "ABSENT")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
