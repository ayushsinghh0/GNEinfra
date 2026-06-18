import ExcelJS from "exceljs";

// Export/import for execution activities (ProjectActivity + DprEntry). A single
// "Activities" sheet with a styled brand header showing each activity, its total
// target, cumulative done, and a computed completion %. Mirrors the Materials
// workbook helpers (buildMaterialsWorkbook / parseMaterialsWorkbook) in style.

type ActRow = {
  activity: string;
  subActivity?: string | null;
  uom?: string | null;
  totalQty?: number | null;
  cumulative?: number | null;
};

// Parsed shape: ready for the import route to turn into ProjectActivity rows.
type ParsedAct = {
  activity: string;
  subActivity: string | null;
  uom: string | null;
  totalQty: number | null;
  cumulative: number | null;
};

const COLS = ["Activity", "Sub-Activity", "Unit", "Total", "Done", "Completion %"] as const;

function completion(done: number | null | undefined, total: number | null | undefined): string {
  if (total != null && total > 0) {
    return `${Math.round(((done ?? 0) / total) * 100)}%`;
  }
  return "";
}

function actToRow(it: ActRow): (string | number | null)[] {
  return [
    it.activity,
    it.subActivity ?? null,
    it.uom ?? null,
    it.totalQty ?? null,
    it.cumulative ?? null,
    completion(it.cumulative, it.totalQty),
  ];
}

const BRAND = "FF0F766E";

// Add the "Activities" sheet to an existing workbook and return it. Shared by
// buildActivitiesWorkbook (single export) and the full-project workbook so both
// render the same header + completion mapping.
export function addActivitiesSheet(
  wb: ExcelJS.Workbook,
  opts: { gneId: string; items?: ActRow[]; template?: boolean }
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet("Activities");

  ws.columns = COLS.map((c) => ({
    width: c === "Activity" || c === "Sub-Activity" ? 40 : 14,
  }));

  ws.addRow([`Execution Activities — ${opts.gneId}`]).font = { bold: true, size: 13 };
  ws.addRow([]);

  const header = ws.addRow([...COLS]);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  });

  const items = opts.items ?? [];
  if (opts.template) {
    ws.addRow(
      actToRow({
        activity: "Example — Module mounting",
        subActivity: "MMS installation",
        uom: "Nos",
        totalQty: 1000,
        cumulative: 600,
      })
    );
  } else {
    for (const it of items) {
      ws.addRow(actToRow(it));
    }
  }

  return ws;
}

export async function buildActivitiesWorkbook(opts: {
  gneId: string;
  items?: ActRow[];
  template?: boolean;
}): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GNE ERP";
  addActivitiesSheet(wb, opts);
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

// Parse an uploaded Activities workbook (the exported / template format — a
// single sheet). Header row is the row containing "Activity".
export async function parseActivitiesWorkbook(
  buffer: Buffer,
  projectId: string
): Promise<{ rows: ParsedAct[]; skipped: number }> {
  // projectId is part of the shared parse signature; rows are bound to the
  // project by the import route when it creates each ProjectActivity.
  void projectId;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  const rows: ParsedAct[] = [];
  let skipped = 0;

  for (const ws of wb.worksheets) {
    // Locate the header row (the one containing "Activity").
    let headerRowNum = 0;
    const colMap: Record<string, number> = {};
    for (let n = 1; n <= Math.min(ws.rowCount, 12); n++) {
      const row = ws.getRow(n);
      const texts: Record<string, number> = {};
      let hasActivity = false;
      row.eachCell((cell, c) => {
        const k = cellText(cell.value)?.toLowerCase();
        if (!k) return;
        texts[k] = c;
        if (/^activity$/.test(k)) hasActivity = true;
      });
      if (hasActivity) {
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
    const cActivity = find("activity");
    const cSub = find("sub-activity", "sub activity", "subactivity");
    const cUom = find("unit", "uom");
    const cTotal = find("total");
    const cDone = find("done", "cumulative");
    // "Completion %" is intentionally ignored — it is a derived display value.
    if (!cActivity) continue;

    for (let n = headerRowNum + 1; n <= ws.rowCount; n++) {
      const row = ws.getRow(n);
      const activity = cellText(row.getCell(cActivity).value);
      if (!activity) {
        // A non-empty but Activity-less row is counted as skipped.
        if (row.cellCount > 0 && row.hasValues) skipped++;
        continue;
      }

      rows.push({
        activity,
        subActivity: cSub ? cellText(row.getCell(cSub).value) : null,
        uom: cUom ? cellText(row.getCell(cUom).value) : null,
        totalQty: cTotal ? cellNum(row.getCell(cTotal).value) : null,
        cumulative: cDone ? cellNum(row.getCell(cDone).value) : null,
      });
    }
  }

  return { rows, skipped };
}
