// Shared helpers for the Project Management module.

export const STAGE_LABELS: Record<string, string> = {
  PLANNING: "Planning",
  ENGINEERING: "Engineering",
  PROCUREMENT: "Procurement",
  CONSTRUCTION: "Construction",
  TESTING: "Testing",
  COMMISSIONING: "Commissioning",
  LIVE: "Live",
  HANDOVER: "Handover",
  CLOSED: "Closed",
};

export const STAGE_ORDER = [
  "PLANNING",
  "ENGINEERING",
  "PROCUREMENT",
  "CONSTRUCTION",
  "TESTING",
  "COMMISSIONING",
  "LIVE",
  "HANDOVER",
  "CLOSED",
];

// Tailwind ring/bg/text classes for a stage badge.
export const STAGE_TONE: Record<string, string> = {
  PLANNING: "bg-slate-100 text-slate-600 ring-slate-500/20",
  ENGINEERING: "bg-violet-50 text-violet-700 ring-violet-600/20",
  PROCUREMENT: "bg-blue-50 text-blue-700 ring-blue-600/20",
  CONSTRUCTION: "bg-amber-50 text-amber-700 ring-amber-600/20",
  TESTING: "bg-cyan-50 text-cyan-700 ring-cyan-600/20",
  COMMISSIONING: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  LIVE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  HANDOVER: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CLOSED: "bg-slate-100 text-slate-500 ring-slate-400/20",
};

export function activityPct(doneQty: number, totalQty?: number | null): number {
  if (!totalQty || totalQty <= 0) return 0;
  return Math.min(100, Math.round((doneQty / totalQty) * 100));
}

export function milestonePct(milestones: { status: string }[]): number {
  if (!milestones.length) return 0;
  const done = milestones.filter((m) => m.status === "DONE").length;
  return Math.round((done / milestones.length) * 100);
}

export function fmtCapacity(ac?: number | null, dc?: number | null): string {
  const parts: string[] = [];
  if (ac != null) parts.push(`${ac} MWac`);
  if (dc != null) parts.push(`${dc} MWdc`);
  return parts.join(" · ") || "—";
}

export function fmtCr(v?: number | null): string {
  return v != null ? `₹${v} Cr` : "—";
}
