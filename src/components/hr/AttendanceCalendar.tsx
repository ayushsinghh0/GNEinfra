"use client";

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
 * Cell width is responsive (`h-9 … sm:h-11`) so a full 7-column month never
 * forces horizontal scroll on narrow phones; the day grid is `inline-grid`
 * so fixed-size cells stay tightly packed instead of stretching to fill a
 * wide parent (a plain `grid` with 1fr tracks would space them apart).
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
  const cellSize = compact ? "h-7 w-7" : "h-9 w-9 sm:h-11 sm:w-11";
  const gap = compact ? "gap-0.5" : "gap-0.5 sm:gap-1";

  return (
    <div className="select-none">
      {!compact && (
        <div className={cn("mb-1 inline-grid grid-cols-7", gap)}>
          {WD.map((w, i) => (
            <div key={i} className="w-9 text-center text-[10px] font-semibold uppercase text-slate-400 sm:w-11">
              {w}
            </div>
          ))}
        </div>
      )}
      <div className={cn("inline-grid grid-cols-7", gap)}>
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
          return (
            <div key={day} className={cls} aria-label={label}>
              {glyph}
            </div>
          );
        })}
      </div>
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
