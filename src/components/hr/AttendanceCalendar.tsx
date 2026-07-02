"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/components/ui";
import { STATUS, WD } from "./attendance-status";
import type { AttendanceStatusValue } from "@/lib/hr-validation";

type Cell = AttendanceStatusValue | "";

/**
 * One employee, one month, as a 7-column calendar heatmap.
 *
 * - `compact` (small-multiples / org overview): color-only tiles, no glyph,
 *   no day number, no header — non-interactive regardless of `canWrite`.
 * - Normal (single-employee focus): full glyph + day number, and — when
 *   `canWrite` and paint handlers are supplied — each day is a paintable
 *   button wired to the SAME cellDown/cellEnter drag-to-paint contract the
 *   table matrix uses, so painting behaves identically in both views.
 *
 * `compact` cells are a fixed small size (`inline-grid`, shrink-wrapped) —
 * intentionally tiny for the small-multiples overview. Non-compact cells are
 * FLUID: `w-full aspect-square` inside a `grid-cols-7` track that fills its
 * (width-capped) parent, so each day is as large as the available width
 * allows — comfortably clearing the 44px tap-target guardrail on desktop —
 * while still never forcing horizontal scroll on narrow phones (the grid
 * shrinks to fit instead of overflowing). See the `max-w-sm` wrapper below.
 */
export default function AttendanceCalendar({
  year,
  month,
  daysInMonth,
  cells,
  canWrite = false,
  onCellDown,
  onCellEnter,
  compact = false,
}: {
  year: number;
  month: number;
  daysInMonth: number;
  cells: Record<number, Cell>;
  canWrite?: boolean;
  onCellDown?: (day: number) => void;
  onCellEnter?: (day: number) => void;
  compact?: boolean;
}) {
  const leading = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();

  const now = new Date();
  const tY = now.getUTCFullYear(), tM = now.getUTCMonth() + 1, tD = now.getUTCDate();

  const interactive = !compact && canWrite && !!(onCellDown || onCellEnter);
  // Compact: fixed tiny size, shrink-wrapped (small-multiples). Non-compact:
  // fluid square that fills its grid column — `min-h`/`max-w` just guard the
  // extremes (a vanishingly narrow parent, or an uncapped wide one).
  const cellSize = compact ? "h-7 w-7" : "aspect-square w-full min-h-9 max-w-14";
  const gap = compact ? "gap-0.5" : "gap-0.5 sm:gap-1";
  const gridDisplay = compact ? "inline-grid" : "grid";

  // Roving tabindex: exactly one day cell is a Tab stop at a time; arrow keys
  // move it. Defaults to "today" when this month is the current one, else
  // day 1. Re-derived (not via an effect — an in-render "adjust state when a
  // prop changes" reset, per React's guidance) whenever the displayed period
  // changes, so navigating months resets the Tab stop instead of leaving it
  // pinned to a day that may not exist in the new month.
  // Only wired up for the non-compact calendar: `compact` (small-multiples)
  // cells are always plain, non-focusable tiles nested inside a single
  // parent <button> (see AttendanceGrid's org-overview grid) — giving each
  // of those cells its own Tab stop would nest focusable content inside a
  // <button>, which is both invalid markup and a worse experience than the
  // one summary Tab stop it already has.
  const defaultFocusedDay = () => (tY === year && tM === month ? Math.min(tD, daysInMonth) : 1);
  const [focusedDay, setFocusedDay] = useState(defaultFocusedDay);
  const period = `${year}-${month}`;
  const [trackedPeriod, setTrackedPeriod] = useState(period);
  if (trackedPeriod !== period) {
    setTrackedPeriod(period);
    setFocusedDay(defaultFocusedDay());
  }

  const cellRefs = useRef(new Map<number, HTMLElement>());
  function registerCell(day: number, el: HTMLElement | null) {
    if (el) cellRefs.current.set(day, el);
    else cellRefs.current.delete(day);
  }
  function moveFocusTo(day: number) {
    const clamped = Math.min(daysInMonth, Math.max(1, day));
    setFocusedDay(clamped);
    cellRefs.current.get(clamped)?.focus();
  }
  // Shared by both the paintable button cells and the read-only-but-focusable
  // cells: arrow keys always move the roving Tab stop; Enter/Space only paints
  // (calls the SAME onCellDown the pointer path uses) when `interactive` — a
  // read-only calendar stays read-only from the keyboard too.
  function onCellKeyDown(e: KeyboardEvent<HTMLElement>, day: number) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.key) {
      case "ArrowLeft": e.preventDefault(); moveFocusTo(day - 1); break;
      case "ArrowRight": e.preventDefault(); moveFocusTo(day + 1); break;
      case "ArrowUp": e.preventDefault(); moveFocusTo(day - 7); break;
      case "ArrowDown": e.preventDefault(); moveFocusTo(day + 7); break;
      case "Enter":
        if (interactive) onCellDown?.(day);
        break;
      case " ":
        e.preventDefault(); // don't scroll the page
        if (interactive) onCellDown?.(day);
        break;
      default:
        break;
    }
  }

  const calendar = (
    <>
      {!compact && (
        <div className={cn("mb-1", gridDisplay, "grid-cols-7", gap)}>
          {WD.map((w, i) => (
            <div key={i} className="text-center text-[10px] font-semibold uppercase text-slate-400">
              {w}
            </div>
          ))}
        </div>
      )}
      <div className={cn(gridDisplay, "grid-cols-7", gap)}>
        {Array.from({ length: leading }, (_, i) => (
          <div key={`lead-${i}`} className={cellSize} aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
          const weekend = dow === 0 || dow === 6;
          const today = tY === year && tM === month && tD === day;
          const status: Cell = cells[day] || "";
          const meta = status ? STATUS[status] : null;
          const label = `Day ${day}: ${meta ? meta.label : "unmarked"}`;

          // Unmarked in-month days always carry a faint background (weekend a
          // touch darker — "muted") so they stay visibly distinct from the
          // truly-blank leading offset cells even in compact (glyph-free) mode.
          const cls = cn(
            "relative grid place-items-center overflow-hidden rounded-md motion-safe:transition-colors",
            cellSize,
            meta ? meta.cell : weekend ? "bg-slate-100 text-slate-400" : "bg-slate-50 text-slate-300",
            today && (compact ? "ring-1 ring-brand" : "ring-2 ring-brand ring-offset-1")
          );

          const glyph = (
            <>
              {status === "HALF_DAY" && <HalfDaySplit />}
              {!compact && (
                <>
                  {meta && status !== "HALF_DAY" && (
                    <span className="relative z-[1] text-[11px] font-bold">{meta.code}</span>
                  )}
                  {!meta && <span className="relative z-[1] text-slate-300">·</span>}
                  <span
                    className={cn(
                      "nums absolute right-0.5 top-0.5 z-[1] text-[9px] font-medium leading-none",
                      weekend ? "text-slate-400/80" : "text-slate-400"
                    )}
                  >
                    {day}
                  </span>
                </>
              )}
            </>
          );

          if (interactive) {
            return (
              <button
                key={day}
                type="button"
                ref={(el) => registerCell(day, el)}
                tabIndex={day === focusedDay ? 0 : -1}
                onKeyDown={(e) => onCellKeyDown(e, day)}
                onPointerDown={() => onCellDown?.(day)}
                onPointerEnter={() => onCellEnter?.(day)}
                aria-label={label}
                className={cn(
                  cls,
                  "cursor-pointer hover:ring-1 hover:ring-brand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                )}
              >
                {glyph}
              </button>
            );
          }
          // Non-compact, read-only (canWrite=false or no paint handlers): still
          // part of the roving-tabindex grid so the calendar is readable by
          // keyboard, but Enter/Space no-ops (onCellKeyDown checks `interactive`).
          if (!compact) {
            return (
              <div
                key={day}
                ref={(el) => registerCell(day, el)}
                tabIndex={day === focusedDay ? 0 : -1}
                onKeyDown={(e) => onCellKeyDown(e, day)}
                aria-label={label}
                className={cn(cls, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40")}
              >
                {glyph}
              </div>
            );
          }
          return (
            <div key={day} className={cls} aria-label={label}>
              {glyph}
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="select-none">
      {compact ? calendar : <div className="w-full max-w-sm">{calendar}</div>}
    </div>
  );
}

// Half-day = a diagonal two-triangle split rather than a single flat tint, so
// it reads as "half" at a glance even in the compact (color-only) heatmap.
function HalfDaySplit() {
  return (
    <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <polygon points="0,0 40,0 0,40" fill="#bfdbfe" />
      <polygon points="40,0 40,40 0,40" fill="#3b82f6" />
    </svg>
  );
}
