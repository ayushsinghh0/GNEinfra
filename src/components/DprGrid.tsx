"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, btn, cn } from "@/components/ui";
import RecordForm from "@/components/RecordForm";
import { valueDone, isCompleted } from "@/lib/projects";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Pencil,
  Save,
  Trash2,
} from "lucide-react";

/* ── Types (all dates are plain YYYY-MM-DD strings; no Date objects cross the
      server→client boundary) ─────────────────────────────────────────────── */
type Kind = "VALUE" | "COM" | "NONE";
type Entry = { date: string; qtyDone: number; kind: Kind };
type Activity = {
  id: string;
  activity: string;
  subActivity: string | null;
  uom: string | null;
  totalQty: number | null;
  startDate: string | null;
  endDate: string | null;
  activitySerial: number | null;
  sortOrder: number;
  remarks: string | null;
  entries: Entry[];
};
type CellEdit = { activityId: string; date: string; kind: Kind; qtyDone?: number };

const WINDOW = 21; // days visible per page

const key = (activityId: string, date: string) => `${activityId}|${date}`;

function fmtNum(n: number | null | undefined) {
  if (n == null) return "—";
  return Number(n.toFixed(2)).toLocaleString("en-IN");
}

// Date math in UTC so a YYYY-MM-DD string never shifts by timezone — it must
// round-trip exactly back to the same string the server understands.
function shiftDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}
function buildWindow(end: string, count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(shiftDays(end, -i));
  return out;
}
// Short, scannable header label: "06\nWed" style — day number + weekday.
function dayParts(ymd: string): { dom: string; dow: string; mon: string } {
  const d = new Date(`${ymd}T00:00:00Z`);
  return {
    dom: String(d.getUTCDate()).padStart(2, "0"),
    dow: d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }),
    mon: d.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" }),
  };
}
function fmtRange(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export default function DprGrid({
  projectId,
  activities,
  dates,
}: {
  projectId: string;
  activities: Activity[];
  dates: string[];
}) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<string, CellEdit>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyDelete, setBusyDelete] = useState<string | null>(null);

  // The visible window. Defaults to the server-computed window (last 21 days
  // ending today); prev/next-week & jump-to-today move the *end* date, and the
  // window is always re-derived so the DOM stays bounded to WINDOW columns.
  const [windowEnd, setWindowEnd] = useState<string>(
    () => dates[dates.length - 1] ?? todayYmd()
  );
  const cols = useMemo(() => buildWindow(windowEnd, WINDOW), [windowEnd]);
  const today = todayYmd();

  // O(1) lookup of the persisted entry for a cell.
  const baseline = useMemo(() => {
    const m = new Map<string, Entry>();
    for (const a of activities) {
      for (const e of a.entries) m.set(key(a.id, e.date), e);
    }
    return m;
  }, [activities]);

  const dirtyCount = Object.keys(edits).length;

  /* ── Cell mutation ──────────────────────────────────────────────────────
     setCellValue: "" → NONE (delete); number → VALUE. toggleCom flips a cell
     to/from the COM marker. Each writes the dirty map; if an edit returns the
     cell to its persisted state we drop it from the map so Save only sends
     genuine changes. ─────────────────────────────────────────────────────── */
  function applyEdit(activityId: string, date: string, next: CellEdit | null) {
    const k = key(activityId, date);
    setError(null);
    setEdits((prev) => {
      const out = { ...prev };
      const base = baseline.get(k);
      const matchesBase =
        next != null &&
        ((next.kind === "NONE" && !base) ||
          (base != null &&
            base.kind === next.kind &&
            (next.kind !== "VALUE" || (base.qtyDone ?? 0) === (next.qtyDone ?? 0))));
      if (next == null || matchesBase) delete out[k];
      else out[k] = next;
      return out;
    });
  }

  function setCellValue(activityId: string, date: string, raw: string) {
    const trimmed = raw.trim();
    if (trimmed === "") {
      // Clearing a cell marks it for delete (NONE, no value).
      applyEdit(activityId, date, { activityId, date, kind: "NONE" });
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return; // ignore invalid keystrokes
    applyEdit(activityId, date, { activityId, date, kind: "VALUE", qtyDone: n });
  }

  function toggleCom(activityId: string, date: string) {
    const k = key(activityId, date);
    const current = effective(activityId, date);
    if (current.kind === "COM") {
      // Toggling Com off clears the cell (delete).
      applyEdit(activityId, date, { activityId, date, kind: "NONE" });
    } else {
      applyEdit(activityId, date, { activityId, date, kind: "COM" });
    }
    // keep keyboard focus context tidy — re-key not needed
    void k;
  }

  // The effective (edited-or-persisted) state of a cell.
  function effective(activityId: string, date: string): CellEdit {
    const k = key(activityId, date);
    if (k in edits) return edits[k];
    const base = baseline.get(k);
    if (!base) return { activityId, date, kind: "NONE" };
    return {
      activityId,
      date,
      kind: base.kind,
      qtyDone: base.kind === "VALUE" ? base.qtyDone : undefined,
    };
  }

  /* ── Save ───────────────────────────────────────────────────────────────
     One PUT with every dirty cell. On a cap error the server message is shown
     inline and the edits are KEPT so nothing the user typed is lost. ─────── */
  async function save() {
    const cells = Object.values(edits);
    if (!cells.length) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/dpr/grid`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cells }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not save");
      setEdits({});
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function del(activityId: string, label: string) {
    if (!window.confirm(`Delete activity “${label}” and all its daily entries? This cannot be undone.`))
      return;
    setBusyDelete(activityId);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/activities/${activityId}`,
        { method: "DELETE" }
      );
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not delete");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyDelete(null);
    }
  }

  /* ── Keyboard navigation across the date band (nice-to-have) ───────────── */
  const gridRef = useRef<HTMLTableElement>(null);
  function focusCell(rowIdx: number, colIdx: number) {
    const sel = `[data-cell="${rowIdx}-${colIdx}"] input, [data-cell="${rowIdx}-${colIdx}"] button`;
    const el = gridRef.current?.querySelector<HTMLElement>(sel);
    el?.focus();
  }
  function onCellKey(
    e: React.KeyboardEvent,
    rowIdx: number,
    colIdx: number
  ) {
    let r = rowIdx;
    let c = colIdx;
    if (e.key === "ArrowLeft" && c > 0) c--;
    else if (e.key === "ArrowRight" && c < cols.length - 1) c++;
    else if (e.key === "ArrowUp" && r > 0) r--;
    else if (e.key === "ArrowDown" && r < activities.length - 1) r++;
    else return;
    e.preventDefault();
    focusCell(r, c);
  }

  // Frozen-column geometry (sticky offsets must be exact for clean overlap).
  const FROZEN = "sticky z-20 bg-white";

  return (
    <div className="space-y-4">
      {/* ── Toolbar: window label + navigation + Save ──────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-600 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <span className="font-medium text-slate-700">Showing</span>
            <span className="tabular-nums text-slate-900">{fmtRange(cols[0])}</span>
            <span className="text-slate-300">→</span>
            <span className="tabular-nums text-slate-900">{fmtRange(cols[cols.length - 1])}</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setWindowEnd((e) => shiftDays(e, -7))}
              className={btn("secondary", "sm")}
              title="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev week
            </button>
            <button
              type="button"
              onClick={() => setWindowEnd(today)}
              className={btn("ghost", "sm")}
              title="Jump to today"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setWindowEnd((e) => shiftDays(e, 7))}
              disabled={cols[cols.length - 1] >= today}
              className={btn("secondary", "sm")}
              title="Next week"
            >
              Next week
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {dirtyCount > 0 && (
            <span className="text-sm text-amber-600">
              {dirtyCount} unsaved {dirtyCount === 1 ? "change" : "changes"}
            </span>
          )}
          <Button
            type="button"
            onClick={save}
            disabled={saving || dirtyCount === 0}
            title={dirtyCount === 0 ? "No changes to save" : "Save changes"}
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* ── Inline error (cap message etc.) — edits are kept ───────────── */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── The grid ───────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <table
          ref={gridRef}
          className="min-w-full border-separate border-spacing-0 text-sm"
        >
          <thead>
            <tr>
              <th
                className={cn(
                  FROZEN,
                  "left-0 top-0 z-30 min-w-[180px] border-b border-r border-slate-200 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400"
                )}
              >
                Activity
              </th>
              <th
                className={cn(
                  FROZEN,
                  "left-[180px] top-0 z-30 hidden min-w-[140px] border-b border-r border-slate-200 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 lg:table-cell"
                )}
              >
                Sub-activity
              </th>
              <th className="sticky top-0 z-10 border-b border-r border-slate-200 bg-slate-50/95 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 backdrop-blur">
                UOM
              </th>
              <th className="sticky top-0 z-10 border-b border-r border-slate-200 bg-slate-50/95 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400 backdrop-blur">
                Total
              </th>
              <th className="sticky top-0 z-10 border-b border-r border-slate-200 bg-slate-50/95 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400 backdrop-blur">
                Cumul.
              </th>
              <th className="sticky top-0 z-10 border-b border-r-2 border-slate-200 border-r-slate-300 bg-slate-50/95 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400 backdrop-blur">
                %
              </th>
              {cols.map((d) => {
                const p = dayParts(d);
                const isToday = d === today;
                return (
                  <th
                    key={d}
                    className={cn(
                      "sticky top-0 z-10 min-w-[3.25rem] border-b border-slate-200 px-1 py-1.5 text-center backdrop-blur",
                      isToday ? "bg-brand-50/95" : "bg-slate-50/95"
                    )}
                    title={fmtRange(d)}
                  >
                    <div
                      className={cn(
                        "text-[13px] font-semibold tabular-nums leading-none",
                        isToday ? "text-brand-700" : "text-slate-700"
                      )}
                    >
                      {p.dom}
                    </div>
                    <div
                      className={cn(
                        "mt-0.5 text-[10px] uppercase leading-none",
                        isToday ? "text-brand-500" : "text-slate-400"
                      )}
                    >
                      {p.dow}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {activities.length === 0 ? (
              <tr>
                <td
                  colSpan={6 + cols.length}
                  className="px-4 py-16 text-center text-sm text-slate-400"
                >
                  No activities yet. Add one from the Progress tab.
                </td>
              </tr>
            ) : (
              activities.map((a, rowIdx) => {
                // Cumulative & % are READ-ONLY and derived from persisted +
                // edited VALUE cells; % is 100% the moment any cell is COM.
                const mergedEntries: Entry[] = cols
                  .map((d) => {
                    const eff = effective(a.id, d);
                    if (eff.kind === "NONE") return null;
                    return {
                      date: d,
                      kind: eff.kind,
                      qtyDone: eff.kind === "VALUE" ? eff.qtyDone ?? 0 : 0,
                    } as Entry;
                  })
                  .filter((e): e is Entry => e != null);
                // Persisted entries outside the visible window still count.
                const outside = a.entries.filter(
                  (e) => !cols.includes(e.date)
                );
                const allForCalc = [...outside, ...mergedEntries];
                const cumulative = valueDone(allForCalc);
                const completed = isCompleted(allForCalc);
                const pct = completed
                  ? 100
                  : a.totalQty && a.totalQty > 0
                    ? Math.min(100, Math.round((cumulative / a.totalQty) * 100))
                    : 0;
                const rowDeleting = busyDelete === a.id;

                return (
                  <tr
                    key={a.id}
                    className={cn(
                      "group",
                      rowDeleting && "opacity-40"
                    )}
                  >
                    {/* Frozen: Activity (with inline edit/delete) */}
                    <td
                      className={cn(
                        FROZEN,
                        "left-0 z-20 min-w-[180px] border-b border-r border-slate-100 px-4 py-2.5 align-top group-hover:bg-slate-50/70"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900" title={a.activity}>
                            {a.activity}
                          </div>
                          <div className="truncate text-xs text-slate-400 lg:hidden" title={a.subActivity ?? ""}>
                            {a.subActivity || ""}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          <RecordForm
                            title="Edit activity"
                            triggerLabel=""
                            triggerVariant="ghost"
                            triggerSize="sm"
                            method="PATCH"
                            submitLabel="Save changes"
                            triggerIcon={<Pencil className="h-3.5 w-3.5" />}
                            endpoint={`/api/projects/${projectId}/activities/${a.id}`}
                            fields={[
                              { name: "activity", label: "Activity", required: true, span: 2, defaultValue: a.activity },
                              { name: "subActivity", label: "Sub-activity", span: 2, defaultValue: a.subActivity ?? "" },
                              { name: "uom", label: "UOM", defaultValue: a.uom ?? "" },
                              { name: "totalQty", label: "Total qty", type: "number", defaultValue: a.totalQty ?? "" },
                              { name: "startDate", label: "Start date", type: "date", defaultValue: a.startDate ?? "" },
                              { name: "endDate", label: "End date", type: "date", defaultValue: a.endDate ?? "" },
                              { name: "activitySerial", label: "Activity serial", type: "number", defaultValue: a.activitySerial ?? "" },
                              { name: "sortOrder", label: "Sort order", type: "number", defaultValue: a.sortOrder },
                              { name: "remarks", label: "Remarks", type: "textarea", defaultValue: a.remarks ?? "" },
                            ]}
                          />
                          <button
                            type="button"
                            onClick={() => del(a.id, a.activity)}
                            disabled={rowDeleting}
                            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                            title="Delete activity"
                            aria-label={`Delete ${a.activity}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Frozen: Sub-activity (lg+) */}
                    <td
                      className={cn(
                        FROZEN,
                        "left-[180px] z-20 hidden min-w-[140px] border-b border-r border-slate-100 px-3 py-2.5 align-top text-slate-600 group-hover:bg-slate-50/70 lg:table-cell"
                      )}
                    >
                      <div className="truncate text-sm" title={a.subActivity ?? ""}>
                        {a.subActivity || "—"}
                      </div>
                    </td>

                    {/* UOM */}
                    <td className="border-b border-r border-slate-100 px-3 py-2.5 align-middle text-slate-500">
                      {a.uom || "—"}
                    </td>
                    {/* Total */}
                    <td className="border-b border-r border-slate-100 px-3 py-2.5 text-right align-middle tabular-nums text-slate-700">
                      {fmtNum(a.totalQty)}
                    </td>
                    {/* Cumulative (read-only, VALUE-only) */}
                    <td className="border-b border-r border-slate-100 px-3 py-2.5 text-right align-middle tabular-nums font-medium text-slate-900">
                      {fmtNum(cumulative)}
                    </td>
                    {/* % (read-only; 100% on COM) */}
                    <td className="border-b border-r-2 border-slate-100 border-r-slate-200 px-3 py-2.5 text-right align-middle">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 tabular-nums font-semibold",
                          pct >= 100 ? "text-emerald-600" : "text-slate-700"
                        )}
                      >
                        {completed && <CheckCircle2 className="h-3.5 w-3.5" />}
                        {pct}%
                      </span>
                    </td>

                    {/* Editable date cells */}
                    {cols.map((d, colIdx) => {
                      const eff = effective(a.id, d);
                      const k = key(a.id, d);
                      const dirty = k in edits;
                      const isCom = eff.kind === "COM";
                      const isToday = d === today;
                      const cellTone = cn(
                        "border-b border-slate-100 p-0 align-middle",
                        isToday && "bg-brand-50/30",
                        dirty && "bg-amber-50"
                      );
                      return (
                        <td
                          key={d}
                          className={cellTone}
                          data-cell={`${rowIdx}-${colIdx}`}
                        >
                          {isCom ? (
                            <button
                              type="button"
                              onClick={() => toggleCom(a.id, d)}
                              onKeyDown={(e) => onCellKey(e, rowIdx, colIdx)}
                              className="grid h-9 w-full place-items-center text-[11px] font-bold uppercase tracking-wide text-emerald-600 outline-none ring-inset focus:ring-2 focus:ring-brand/40"
                              title="Marked complete — click to clear"
                              aria-label={`${a.activity} ${d}: complete`}
                            >
                              Com
                            </button>
                          ) : (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={
                                eff.kind === "VALUE" && eff.qtyDone != null
                                  ? String(eff.qtyDone)
                                  : ""
                              }
                              onChange={(e) =>
                                setCellValue(a.id, d, e.target.value)
                              }
                              onKeyDown={(e) => {
                                // "c" toggles the Com marker on an empty/any cell.
                                if (e.key.toLowerCase() === "c") {
                                  e.preventDefault();
                                  toggleCom(a.id, d);
                                  return;
                                }
                                onCellKey(e, rowIdx, colIdx);
                              }}
                              className={cn(
                                "h-9 w-full bg-transparent px-1 text-center text-[13px] tabular-nums text-slate-900 outline-none ring-inset placeholder:text-slate-300 focus:ring-2 focus:ring-brand/40",
                                dirty && "font-semibold text-amber-700"
                              )}
                              placeholder="·"
                              aria-label={`${a.activity} ${d}: quantity (press c for Com)`}
                              title="Type a number, or press “c” to mark Com"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-400">
        <span>
          Type a <span className="font-medium text-slate-600">number</span> to log a day&apos;s quantity.
        </span>
        <span>
          Press <kbd className="rounded border border-slate-300 bg-slate-50 px-1 font-mono text-[10px] text-slate-600">c</kbd> to toggle <span className="font-semibold text-emerald-600">Com</span> (complete).
        </span>
        <span>Clear a cell to remove that day.</span>
        <span>Cumulative &amp; % are read-only.</span>
        <span>Arrow keys move between cells.</span>
      </div>
    </div>
  );
}
