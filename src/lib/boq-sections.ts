// Standard BOQ sections for a solar EPC project, grouped by category — taken
// from the GNE BOQ workbook (BOM-Supply / BOM-Service / Line work). These
// pre-fill the section picker; users can still type a custom section.

export const BOQ_SECTIONS: Record<"SUPPLY" | "SERVICE" | "LINE_WORK", string[]> = {
  SUPPLY: [
    "Modules",
    "Inverters",
    "MMS",
    "Major BOS",
    "Cables",
    "Conduit Pipe",
    "Electrical Termination Items",
    "Lighting & Lightning Material",
    "MCS",
    "Precommissioning & Commissioning Charges",
    "Bay Construction at SS",
    "Overhead Transmission Line",
    "Spares Considered for O&M",
    "Reactive Power Compensation",
  ],
  SERVICE: [
    "Infrastructure Development",
    "Service Activity - Purchase",
    "Pilling Works",
    "Equipment Foundation Cost",
    "Road & Drainage Cost",
    "I & C Works",
    "MCR Works",
  ],
  LINE_WORK: ["Plant to GSS Line"],
};

export const ALL_BOQ_SECTIONS: string[] = [
  ...BOQ_SECTIONS.SUPPLY,
  ...BOQ_SECTIONS.SERVICE,
  ...BOQ_SECTIONS.LINE_WORK,
];

export const BOQ_CATEGORIES = ["SUPPLY", "SERVICE", "LINE_WORK"] as const;

// Best-guess category for a section name (used when importing rows that only
// give a section).
export function categoryForSection(section?: string | null): "SUPPLY" | "SERVICE" | "LINE_WORK" {
  if (!section) return "SUPPLY";
  const s = section.trim().toLowerCase();
  if (BOQ_SECTIONS.SERVICE.some((x) => x.toLowerCase() === s)) return "SERVICE";
  if (BOQ_SECTIONS.LINE_WORK.some((x) => x.toLowerCase() === s)) return "LINE_WORK";
  return "SUPPLY";
}
