// Single source of truth for status → tone across HR (and vendor) enums.
// Static class strings only (Tailwind can't see interpolated names).
type Tone = { label: string; chip: string; dot: string; ring?: string };

const T = {
  emerald: (label: string): Tone => ({
    label,
    chip: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    ring: "ring-emerald-600/20",
  }),
  amber: (label: string): Tone => ({
    label,
    chip: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    ring: "ring-amber-600/20",
  }),
  rose: (label: string): Tone => ({
    label,
    chip: "bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
    ring: "ring-rose-600/20",
  }),
  slate: (label: string): Tone => ({
    label,
    chip: "bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
    ring: "ring-slate-500/20",
  }),
  sky: (label: string): Tone => ({
    label,
    chip: "bg-sky-50 text-sky-700",
    dot: "bg-sky-500",
    ring: "ring-sky-600/20",
  }),
  violet: (label: string): Tone => ({
    label,
    chip: "bg-violet-50 text-violet-700",
    dot: "bg-violet-500",
    ring: "ring-violet-600/20",
  }),
  // Vendor-only tones — reproduce the current Badge.tsx palette VERBATIM
  // (blue for SUBMITTED, and two rose/slate variants distinct from the
  // shared tones above) so /scm/vendors has zero visual regression.
  blue: (label: string): Tone => ({
    label,
    chip: "bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
    ring: "ring-blue-600/20",
  }),
  roseRevoked: (label: string): Tone => ({
    label,
    chip: "bg-rose-50 text-rose-600",
    dot: "bg-rose-500",
    ring: "ring-rose-600/20",
  }),
  slateInvited: (label: string): Tone => ({
    label,
    chip: "bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
    ring: "ring-slate-500/20",
  }),
  slateExpired: (label: string): Tone => ({
    label,
    chip: "bg-slate-100 text-slate-400",
    dot: "bg-slate-300",
    ring: "ring-slate-400/20",
  }),
};

const REGISTRY: Record<string, Tone> = {
  // Attendance
  PRESENT: T.emerald("Present"),
  ABSENT: T.rose("Absent"),
  LEAVE: T.amber("Leave"),
  SICK: T.amber("Sick"),
  HALF_DAY: T.sky("Half-day"),
  HOLIDAY: T.violet("Holiday"),
  WEEK_OFF: T.slate("Week-off"),
  // Employee
  ACTIVE: T.emerald("Active"),
  INACTIVE: T.slate("Inactive"),
  // Project (src/lib/hr-validation.ts PROJECT_STATUSES — ACTIVE/ON_HOLD/COMPLETED only,
  // no PLANNED/ARCHIVED; ACTIVE is shared with Employee status above).
  ON_HOLD: T.amber("On hold"),
  COMPLETED: T.slate("Completed"),
  // Payroll (client-side states)
  DRAFT: T.slate("Draft"),
  UNSAVED: T.amber("Unsaved"),
  SAVED: T.emerald("Saved"),
  // Vendor / invite — verbatim from the pre-registry Badge.tsx palette.
  SUBMITTED: T.blue("Submitted"),
  UNDER_REVIEW: T.amber("Under review"),
  APPROVED: T.emerald("Approved"),
  REJECTED: T.rose("Rejected"),
  INVITED: T.slateInvited("Invited"),
  PENDING: T.amber("Pending"),
  USED: T.emerald("Used"),
  EXPIRED: T.slateExpired("Expired"),
  REVOKED: T.roseRevoked("Revoked"),
};

export function statusMeta(status: string): Tone {
  return REGISTRY[status] ?? T.slate(status.replace(/_/g, " "));
}
