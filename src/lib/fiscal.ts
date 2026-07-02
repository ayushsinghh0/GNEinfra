// Indian fiscal year (April–March) helpers shared by BD + Finance.

/** "FY 25-26" for the fiscal year containing `d`. */
export function fyLabel(d = new Date()): string {
  const start = d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
  const s = String(start % 100).padStart(2, "0");
  const e = String((start + 1) % 100).padStart(2, "0");
  return `FY ${s}-${e}`;
}

/** Short "25-26" form (used inside document numbers like GNE/25-26/0001). */
export function fyShort(d = new Date()): string {
  return fyLabel(d).replace(/^FY /, "");
}

/**
 * Fiscal-year choices for form selects: two back, current, one ahead —
 * newest first so the current year is easy to reach.
 */
export function fyChoices(d = new Date()): string[] {
  const startYear = d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
  return [1, 0, -1, -2].map((offset) => {
    const s = startYear + offset;
    return `FY ${String(s % 100).padStart(2, "0")}-${String((s + 1) % 100).padStart(2, "0")}`;
  });
}
