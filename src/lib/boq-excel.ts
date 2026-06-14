import ExcelJS from "exceljs";
import { ALL_BOQ_SECTIONS, BOQ_SECTIONS, categoryForSection } from "@/lib/boq-sections";

// Column layout shared by the export, the import template, and the importer.
const COLUMNS = [
  { header: "Category", key: "category", width: 14 },
  { header: "Section", key: "section", width: 28 },
  { header: "S.No", key: "serialNo", width: 8 },
  { header: "Description", key: "description", width: 42 },
  { header: "Rating", key: "rating", width: 14 },
  { header: "Specification", key: "specification", width: 30 },
  { header: "UOM", key: "uom", width: 8 },
  { header: "Quantity", key: "quantity", width: 12 },
  { header: "Unit Rate", key: "unitRate", width: 12 },
  { header: "Responsibility", key: "responsibility", width: 16 },
];

type BoqRow = {
  category: string;
  section: string | null;
  serialNo: string | null;
  description: string;
  rating: string | null;
  specification: string | null;
  uom: string | null;
  quantity: number | null;
  unitRate: number | null;
  responsibility: string | null;
};

function styleHeader(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    c.alignment = { vertical: "middle" };
  });
}

// Build the export workbook (current BOQ rows) OR a blank template.
export async function buildBoqWorkbook(opts: {
  gneId: string;
  items?: BoqRow[];
  template?: boolean;
}): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GNE ERP";
  const ws = wb.addWorksheet("BOQ");
  ws.columns = COLUMNS;
  styleHeader(ws);

  if (opts.template) {
    ws.addRow({
      category: "SUPPLY",
      section: "Modules",
      serialNo: "1",
      description: "Example — replace this row",
      rating: "590 Wp",
      uom: "Nos",
      quantity: 1000,
    });
  } else {
    for (const it of opts.items ?? []) ws.addRow(it);
  }

  // Reference sheet listing valid categories + standard sections.
  const ref = wb.addWorksheet("Sections (reference)");
  ref.columns = [
    { header: "Category", key: "c", width: 14 },
    { header: "Standard section", key: "s", width: 36 },
  ];
  styleHeader(ref);
  (["SUPPLY", "SERVICE", "LINE_WORK"] as const).forEach((cat) => {
    BOQ_SECTIONS[cat].forEach((s) => ref.addRow({ c: cat, s }));
  });

  return wb.xlsx.writeBuffer();
}

function cellText(v: ExcelJS.CellValue): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join("").trim() || null;
    if (o.text) return String(o.text).trim() || null;
    if (o.result !== undefined) return String(o.result).trim() || null;
    return null;
  }
  return String(v).trim() || null;
}

function cellNum(v: ExcelJS.CellValue): number | null {
  const t = cellText(v);
  if (t === null) return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

const VALID_CAT = new Set(["SUPPLY", "SERVICE", "LINE_WORK"]);

// Parse an uploaded BOQ workbook into rows ready for prisma.boqItem.createMany.
export async function parseBoqWorkbook(
  buffer: Buffer,
  projectId: string
): Promise<{ rows: (BoqRow & { projectId: string })[]; skipped: number }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return { rows: [], skipped: 0 };

  // Map header names -> column numbers (case-insensitive).
  const header: Record<string, number> = {};
  ws.getRow(1).eachCell((cell, col) => {
    const k = cellText(cell.value)?.toLowerCase();
    if (k) header[k] = col;
  });
  const col = (name: string) => header[name.toLowerCase()];
  const at = (row: ExcelJS.Row, name: string) => {
    const c = col(name);
    return c ? row.getCell(c).value : null;
  };

  const rows: (BoqRow & { projectId: string })[] = [];
  let skipped = 0;

  ws.eachRow((row, n) => {
    if (n === 1) return; // header
    const description = cellText(at(row, "description"));
    if (!description) {
      // ignore fully-blank rows; count rows that have data but no description
      const hasAny = ["category", "section", "quantity", "uom"].some((k) => cellText(at(row, k)));
      if (hasAny) skipped++;
      return;
    }
    let category = cellText(at(row, "category"))?.toUpperCase() ?? "";
    const section = cellText(at(row, "section"));
    if (!VALID_CAT.has(category)) category = categoryForSection(section);

    rows.push({
      projectId,
      category,
      section,
      serialNo: cellText(at(row, "s.no")) ?? cellText(at(row, "sno")),
      description,
      rating: cellText(at(row, "rating")),
      specification: cellText(at(row, "specification")),
      uom: cellText(at(row, "uom")),
      quantity: cellNum(at(row, "quantity")),
      unitRate: cellNum(at(row, "unit rate")),
      responsibility: cellText(at(row, "responsibility")),
    });
  });

  return { rows, skipped };
}

export { ALL_BOQ_SECTIONS };
