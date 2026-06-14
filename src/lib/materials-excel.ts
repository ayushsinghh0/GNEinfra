import ExcelJS from "exceljs";

// Export/import for the PO & MRC materials (ProcurementItem). A single "Materials"
// sheet with a styled brand header and the PO/MRC tracking columns. Mirrors the
// BOQ workbook helpers (buildBoqWorkbook / parseBoqWorkbook) in style and shape.

type MatRow = {
  partner?: string | null;
  type?: string | null;
  description: string;
  uom?: string | null;
  approvedQty?: number | null;
  receivedQty?: number | null;
  receivedDate?: Date | null;
  drawingApproved?: boolean;
  poReleased?: boolean;
  qualitySignoff?: boolean;
  mrcStatus?: string | null;
  paymentStatus?: string | null;
  remarks?: string | null;
};

// Shape that can be passed straight to prisma.procurementItem.createMany.
type ProcurementCreate = {
  projectId: string;
  partner: string | null;
  type: string | null;
  description: string;
  uom: string | null;
  approvedQty: number | null;
  receivedQty: number | null;
  receivedDate: Date | null;
  drawingApproved: boolean;
  poReleased: boolean;
  qualitySignoff: boolean;
  mrcStatus: string | null;
  paymentStatus: string | null;
  remarks: string | null;
};

const COLS = [
  "Description",
  "Type",
  "Partner",
  "UOM",
  "Approved Qty",
  "Received Qty",
  "Received Date",
  "MRC Status",
  "Drawing Approved",
  "PO Released",
  "Quality Signoff",
  "Payment",
  "Remarks",
] as const;

const yesNo = (b?: boolean) => (b ? "Yes" : "No");

function matToRow(it: MatRow): (string | number | Date | null)[] {
  return [
    it.description,
    it.type ?? null,
    it.partner ?? null,
    it.uom ?? null,
    it.approvedQty ?? null,
    it.receivedQty ?? null,
    it.receivedDate ?? null,
    it.mrcStatus ?? null,
    yesNo(it.drawingApproved),
    yesNo(it.poReleased),
    yesNo(it.qualitySignoff),
    it.paymentStatus ?? null,
    it.remarks ?? null,
  ];
}

const BRAND = "FF0F766E";

export async function buildMaterialsWorkbook(opts: {
  gneId: string;
  items?: MatRow[];
  template?: boolean;
}): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GNE ERP";

  const ws = wb.addWorksheet("Materials");

  ws.columns = COLS.map((c) => ({
    width: c === "Description" ? 46 : c === "Remarks" ? 28 : c === "Received Date" ? 14 : 13,
  }));

  ws.addRow([`Materials (PO & MRC) — ${opts.gneId}`]).font = { bold: true, size: 13 };
  ws.addRow([]);

  const header = ws.addRow([...COLS]);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  });

  const items = opts.items ?? [];
  if (opts.template) {
    const row = ws.addRow(
      matToRow({
        partner: "Datum",
        type: "BOS",
        description: "Example — DC cable 4 sqmm",
        uom: "Mtr",
        approvedQty: 1000,
        receivedQty: 600,
        receivedDate: new Date(),
        drawingApproved: true,
        poReleased: true,
        qualitySignoff: false,
        mrcStatus: "WIP",
        paymentStatus: "Pending",
        remarks: "Add your rows below this one",
      })
    );
    row.getCell(7).numFmt = "yyyy-mm-dd";
  } else {
    for (const it of items) {
      const row = ws.addRow(matToRow(it));
      if (it.receivedDate) row.getCell(7).numFmt = "yyyy-mm-dd";
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
function cellDate(v: ExcelJS.CellValue): Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  const t = cellText(v);
  if (t === null) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}
function cellBool(v: ExcelJS.CellValue): boolean {
  const t = cellText(v)?.toLowerCase();
  if (!t) return false;
  return /^(yes|done|y|true|released)$/.test(t);
}

// Parse an uploaded Materials workbook (the exported / template format — a single
// sheet with the PO/MRC columns). Header row is the row containing "Description".
export async function parseMaterialsWorkbook(
  buffer: Buffer,
  projectId: string
): Promise<{ rows: ProcurementCreate[]; skipped: number }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  const rows: ProcurementCreate[] = [];
  let skipped = 0;

  for (const ws of wb.worksheets) {
    // Locate the header row (the one containing "Description").
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
        if (/^description$/.test(k)) hasDesc = true;
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
    const cDesc = find("description");
    const cType = find("type");
    const cPartner = find("partner");
    const cUom = find("uom", "unit");
    const cApproved = find("approved qty", "approved");
    const cReceived = find("received qty", "received");
    const cReceivedDate = find("received date");
    const cMrc = find("mrc status", "mrc");
    const cDrawing = find("drawing approved", "drawing");
    const cPo = find("po released", "po");
    const cQuality = find("quality signoff", "quality");
    const cPayment = find("payment");
    const cRemarks = find("remarks");
    if (!cDesc) continue;

    for (let n = headerRowNum + 1; n <= ws.rowCount; n++) {
      const row = ws.getRow(n);
      const description = cellText(row.getCell(cDesc).value);
      if (!description) {
        // A non-empty but Description-less row is counted as skipped.
        if (row.cellCount > 0 && row.hasValues) skipped++;
        continue;
      }

      rows.push({
        projectId,
        partner: cPartner ? cellText(row.getCell(cPartner).value) : null,
        type: cType ? cellText(row.getCell(cType).value) : null,
        description,
        uom: cUom ? cellText(row.getCell(cUom).value) : null,
        approvedQty: cApproved ? cellNum(row.getCell(cApproved).value) : null,
        receivedQty: cReceived ? cellNum(row.getCell(cReceived).value) : null,
        receivedDate: cReceivedDate ? cellDate(row.getCell(cReceivedDate).value) : null,
        drawingApproved: cDrawing ? cellBool(row.getCell(cDrawing).value) : false,
        poReleased: cPo ? cellBool(row.getCell(cPo).value) : false,
        qualitySignoff: cQuality ? cellBool(row.getCell(cQuality).value) : false,
        mrcStatus: cMrc ? cellText(row.getCell(cMrc).value) : null,
        paymentStatus: cPayment ? cellText(row.getCell(cPayment).value) : null,
        remarks: cRemarks ? cellText(row.getCell(cRemarks).value) : null,
      });
    }
  }

  return { rows, skipped };
}
