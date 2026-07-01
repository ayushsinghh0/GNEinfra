// Shared attendance status metadata — single source of truth for the status
// glyph/label/color used by BOTH the calendar heatmap (AttendanceCalendar)
// and the table matrix (AttendanceGrid), so the two views never drift.
import type { AttendanceStatusValue } from "@/lib/hr-validation";

export const STATUS: Record<
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

// Weekday-initial header, Sunday-first (matches the UTC getUTCDay() index used
// throughout attendance code: 0 = Sunday … 6 = Saturday).
export const WD = ["S", "M", "T", "W", "T", "F", "S"];
