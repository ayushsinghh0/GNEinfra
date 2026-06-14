import ExcelJS from "exceljs";
import { BOQ_SECTIONS, categoryForSection } from "@/lib/boq-sections";

// Export/import that mirror the original GNE BOQ workbook layout: one sheet per
// category (BOM-Supply / BOM-Service / Line work), a capacity header, and the
// items grouped under section heading rows (Modules, Inverters, MMS, ...).

type BoqRow = {
  category: string;
  section: string | null;
  serialNo: string | null;
  description: string;
  rating: string | null;
  specification: string | null;
  uom: string | null;
  quantity: number | null;
  unitRate?: number | null;
  responsibility?: string | null;
};

const SHEETS: {
  cat: "SUPPLY" | "SERVICE" | "LINE_WORK";
  name: string;
  cols: string[];
}[] = [
  { cat: "SUPPLY", name: "BOM-Supply", cols: ["S.No", "Item Description", "Rating/Uses", "UOM", "Specification", "Quantity"] },
  { cat: "SERVICE", name: "BOM-Service", cols: ["S.No", "Item Description", "Specifications", "UOM", "Quantity"] },
  { cat: "LINE_WORK", name: "Line work", cols: ["S.No", "Item Description", "Specification", "UOM", "Quantity", "Responsibility"] },
];

function itemToRow(cat: string, it: BoqRow): (string | number | null)[] {
  if (cat === "SUPPLY") return [it.serialNo, it.description, it.rating, it.uom, it.specification, it.quantity];
  if (cat === "SERVICE") return [it.serialNo, it.description, it.specification, it.uom, it.quantity];
  return [it.serialNo, it.description, it.specification, it.uom, it.quantity, it.responsibility ?? null];
}

function groupBySection(items: BoqRow[]): { section: string; rows: BoqRow[] }[] {
  const order: string[] = [];
  const map = new Map<string, BoqRow[]>();
  for (const it of items) {
    const k = it.section || "Other";
    if (!map.has(k)) { map.set(k, []); order.push(k); }
    map.get(k)!.push(it);
  }
  return order.map((s) => ({ section: s, rows: map.get(s)! }));
}

const BRAND = "FF0F766E";

export async function buildBoqWorkbook(opts: {
  gneId: string;
  capacityAcMw?: number | null;
  capacityDcMw?: number | null;
  items?: BoqRow[];
  template?: boolean;
}): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GNE ERP";

  for (const def of SHEETS) {
    const ws = wb.addWorksheet(def.name);
    ws.columns = def.cols.map((c, i) => ({
      width: i === 0 ? 7 : i === 1 ? 48 : c === "Specification" || c === "Specifications" ? 32 : 14,
    }));

    ws.addRow([`BOQ — ${opts.gneId}`]).font = { bold: true, size: 13 };
    ws.addRow(["Plant DC Capacity (MWp)", opts.capacityDcMw ?? ""]);
    ws.addRow(["Plant AC Capacity (MW)", opts.capacityAcMw ?? ""]);
    ws.addRow([]);

    const header = ws.addRow(def.cols);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    });

    const sectionRow = (name: string) => {
      const r = ws.addRow([name]);
      // Style the whole row WITHOUT merging — merged cells make every cell
      // return the master value, which would make the importer read the
      // section heading as an item. The other cells stay genuinely empty.
      for (let c = 1; c <= def.cols.length; c++) {
        const cell = r.getCell(c);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
        if (c === 1) cell.font = { bold: true };
      }
    };

    if (opts.template) {
      const eg = def.cat === "SUPPLY" ? BOQ_SECTIONS.SUPPLY[0] : def.cat === "SERVICE" ? BOQ_SECTIONS.SERVICE[0] : BOQ_SECTIONS.LINE_WORK[0];
      sectionRow(eg);
      ws.addRow(itemToRow(def.cat, {
        category: def.cat, section: eg, serialNo: "1",
        description: "Example — add your rows under the matching section heading",
        rating: null, specification: null, uom: "Nos", quantity: 1,
      }));
    } else {
      const items = (opts.items ?? []).filter((i) => i.category === def.cat);
      for (const g of groupBySection(items)) {
        sectionRow(g.section);
        for (const it of g.rows) ws.addRow(itemToRow(def.cat, it));
      }
    }
  }

  return wb.xlsx.writeBuffer();
}

// ── Import ──────────────────────────────────────────────────────────────────

function cellText(v: ExcelJS.CellValue): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join("").trim() || null;
    if (o.text) return String(o.text).trim() || null;
    if (o.result !== undefined && o.result !== null) return String(o.result).trim() || null;
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
const isNumeric = (s: string) => /^-?\d+(\.\d+)?$/.test(s.trim());
const VALID_CAT = new Set(["SUPPLY", "SERVICE", "LINE_WORK"]);

function sheetCategory(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes("service")) return "SERVICE";
  if (n.includes("supply")) return "SUPPLY";
  if (n.includes("line")) return "LINE_WORK";
  return null;
}

// Parse an uploaded BOQ workbook (the exported / template format — one sheet per
// category, section heading rows). Also tolerates a flat sheet with explicit
// Category/Section columns.
export async function parseBoqWorkbook(
  buffer: Buffer,
  projectId: string
): Promise<{ rows: (BoqRow & { projectId: string })[]; skipped: number }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  const rows: (BoqRow & { projectId: string })[] = [];
  let skipped = 0;

  for (const ws of wb.worksheets) {
    if (/reference|section/i.test(ws.name) && !sheetCategory(ws.name)) continue;
    const sheetCat = sheetCategory(ws.name);

    // Locate the header row (the one containing "Item Description" / "Description").
    let headerRowNum = 0;
    const colMap: Record<string, number> = {};
    for (let n = 1; n <= Math.min(ws.rowCount, 12); n++) {
      const row = ws.getRow(n);
      const texts: Record<string, number> = {};
      let hasDesc = false;
      row.eachCell((cell, c) => {
        const k = cellText(cell.value)?.toLowerCase();
        if (!k) return;
        texts[k] = c;
        if (/item description|^description$/.test(k)) hasDesc = true;
      });
      if (hasDesc) {
        headerRowNum = n;
        Object.assign(colMap, texts);
        break;
      }
    }
    if (!headerRowNum) continue;

    const find = (...names: string[]) => {
      for (const nm of names) {
        for (const key of Object.keys(colMap)) if (key === nm || key.startsWith(nm)) return colMap[key];
      }
      return undefined;
    };
    const cDesc = find("item description", "description");
    const cSerial = find("s.no", "sno", "s no", "sr. no", "sr.no");
    const cRating = find("rating/uses", "rating");
    const cSpec = find("specification", "specifications");
    const cUom = find("uom", "unit");
    const cQty = find("quantity", "qty", "total");
    const cCat = find("category");
    const cSec = find("section");
    const cResp = find("responsibility");
    if (!cDesc) continue;

    let currentSection: string | null = null;
    for (let n = headerRowNum + 1; n <= ws.rowCount; n++) {
      const row = ws.getRow(n);
      const description = cellText(row.getCell(cDesc).value);
      if (!description) {
        // A section heading row: text in the S.No column, not numeric, not "total".
        const a = cellText(row.getCell(cSerial ?? 1).value);
        if (a && !isNumeric(a) && !/^total/i.test(a)) currentSection = a;
        else if (a) skipped++;
        continue;
      }
      if (/^total/i.test(description)) continue;

      const section = (cSec && cellText(row.getCell(cSec).value)) || currentSection;
      let category = (cCat && cellText(row.getCell(cCat).value)?.toUpperCase()) || sheetCat || "";
      if (!VALID_CAT.has(category)) category = categoryForSection(section);

      rows.push({
        projectId,
        category,
        section,
        serialNo: cSerial ? cellText(row.getCell(cSerial).value) : null,
        description,
        rating: cRating ? cellText(row.getCell(cRating).value) : null,
        specification: cSpec ? cellText(row.getCell(cSpec).value) : null,
        uom: cUom ? cellText(row.getCell(cUom).value) : null,
        quantity: cQty ? cellNum(row.getCell(cQty).value) : null,
        unitRate: null,
        responsibility: cResp ? cellText(row.getCell(cResp).value) : null,
      });
    }
  }

  return { rows, skipped };
}
