import ExcelJS from "exceljs";
import { activityPct, valueDone, isCompleted } from "@/lib/projects";
import { addBoqSheets } from "@/lib/boq-excel";
import { addMaterialsSheet } from "@/lib/materials-excel";
import { addActivitiesSheet } from "@/lib/activities-excel";

// Round-trip I/O foundation. Builds the two "source-shaped" sheets that mirror the
// original GNE master workbook layout exactly (header text + column order taken
// verbatim from .git/sdd/xlsx-structure.txt):
//
//   • "Project Details" — one row per project (Overview tab export).
//   • "Activity DPR"     — one row per ProjectActivity, with the union of all
//                          DprEntry dates as trailing day-columns.
//
// Style mirrors src/lib/materials-excel.ts (exceljs, brand header fill). Unlike the
// per-module Materials/Activities/BOQ exports, these reproduce the source sheets'
// exact header rows so the files round-trip cleanly against the master workbook.

const BRAND = "FF0F766E";

// ── Project Details ───────────────────────────────────────────────────────────

// Exact header order from the source "Project Details" sheet (row 2). Column 15
// ("PO") and column 20 (blank) are intentionally left empty — deferred.
const PROJECT_DETAILS_COLS = [
  "Sl.no",
  "Activties",
  "Description",
  "GNE ID",
  "Client name",
  "Tender",
  "State",
  "Cluster Name",
  "Station / Plant Name",
  "Capacity ( MW) AC",
  "Capacity ( MW) DC",
  "PO number",
  "PO Value ( Cr)",
  "Sub Partner",
  "PO",
  "start date",
  "live date",
  "complete date",
  "handover date",
  "",
  "Plant Address",
  "BEL Address",
] as const;

type ProjectRow = {
  gneId: string;
  clientName?: string | null;
  tenderId?: string | null;
  state?: string | null;
  cluster?: string | null;
  plantName?: string | null;
  capacityAcMw?: number | null;
  capacityDcMw?: number | null;
  epcScope?: string | null;
  poNumber?: string | null;
  poValueCr?: number | null;
  subPartner?: string | null;
  startDate?: Date | null;
  liveDate?: Date | null;
  completeDate?: Date | null;
  handoverDate?: Date | null;
  plantAddress?: string | null;
  clientAddress?: string | null;
};

// epcScope is stored as a single string (e.g. "EPC, Without PV"). Split it into
// the source's "Activties" (scope kind) + "Description" pair on the first comma;
// if there is no comma, the whole value is the activity and Description is blank.
function splitScope(scope?: string | null): [string | null, string | null] {
  if (!scope) return [null, null];
  const i = scope.indexOf(",");
  if (i === -1) return [scope.trim() || null, null];
  return [scope.slice(0, i).trim() || null, scope.slice(i + 1).trim() || null];
}

function projectToRow(
  p: ProjectRow,
  serial: number
): (string | number | Date | null)[] {
  const [activity, description] = splitScope(p.epcScope);
  return [
    serial,
    activity,
    description,
    p.gneId,
    p.clientName ?? null,
    p.tenderId ?? null,
    p.state ?? null,
    p.cluster ?? null,
    p.plantName ?? null,
    p.capacityAcMw ?? null,
    p.capacityDcMw ?? null,
    p.poNumber ?? null,
    p.poValueCr ?? null,
    p.subPartner ?? null,
    null, // "PO" — deferred
    p.startDate ?? null,
    p.liveDate ?? null,
    p.completeDate ?? null,
    p.handoverDate ?? null,
    null, // blank spacer column (col 20)
    p.plantAddress ?? null,
    p.clientAddress ?? null,
  ];
}

// Source date columns (16..19) carry yyyy-mm-dd dates.
const PD_DATE_COLS = [16, 17, 18, 19];

// Add the "Project Details" sheet to an existing workbook and return it. Shared
// by buildProjectDetailsWorkbook (single export) and buildFullProjectWorkbook so
// both reproduce the exact source header + row mapping.
export function addProjectDetailsSheet(
  wb: ExcelJS.Workbook,
  projects: ProjectRow[]
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet("Project Details");

  ws.columns = PROJECT_DETAILS_COLS.map((c) => ({
    width:
      c === "Plant Address" || c === "BEL Address"
        ? 48
        : c === "Station / Plant Name" || c === "Cluster Name" || c === "Sub Partner"
          ? 18
          : c === "Activties" || c === "Description"
            ? 16
            : 13,
  }));

  // Source row 1 is blank; the header lives on row 2.
  ws.addRow([]);

  const header = ws.addRow([...PROJECT_DETAILS_COLS]);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  });

  projects.forEach((p, i) => {
    const row = ws.addRow(projectToRow(p, i + 1));
    for (const c of PD_DATE_COLS) {
      if (row.getCell(c).value instanceof Date) row.getCell(c).numFmt = "yyyy-mm-dd";
    }
  });

  return ws;
}

export async function buildProjectDetailsWorkbook(
  projects: ProjectRow[]
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GNE ERP";
  addProjectDetailsSheet(wb, projects);
  return wb.xlsx.writeBuffer();
}

// ── Activity DPR ──────────────────────────────────────────────────────────────

// Fixed leading columns of the source "Activity DPR" sheet (row 2). The trailing
// date columns are appended dynamically from the project's DprEntry dates.
const DPR_FIXED_COLS = [
  "Sl.no",
  "GNE ID",
  "Station / Plant Name",
  "Capacity ( MW)",
  "Sub Partner",
  "Activity Sl.no",
  "Activity",
  "Sub Activity",
  "Start date",
  "End date",
  "Unit",
  "Total",
  "Cumulative",
  "Completion",
] as const;

const DPR_BANNER = "Project daily Activties / date";

type DprEntryLite = { date: Date; qtyDone: number; kind: string };

type DprActivity = {
  activitySerial?: number | null;
  activity: string;
  subActivity?: string | null;
  uom?: string | null;
  totalQty?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  entries: DprEntryLite[];
};

type DprProject = {
  gneId: string;
  plantName?: string | null;
  capacityAcMw?: number | null;
  subPartner?: string | null;
  activities: DprActivity[];
};

// A stable yyyy-mm-dd key for a DprEntry date, computed in UTC so dates stored at
// UTC midnight collapse to a single column regardless of the server timezone.
function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// The sorted union of every DprEntry date across the project's activities — these
// become the trailing day-columns of the sheet.
function unionDates(project: DprProject): string[] {
  const set = new Set<string>();
  for (const a of project.activities) {
    for (const e of a.entries) set.add(dateKey(e.date));
  }
  return [...set].sort();
}

// Add the "Activity DPR" sheet to an existing workbook and return it. Shared by
// buildDprWorkbook (single export) and buildFullProjectWorkbook so both reproduce
// the source banner + dynamic day-columns + derived completion identically.
export function addDprSheet(
  wb: ExcelJS.Workbook,
  project: DprProject
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet("Activity DPR");

  const dates = unionDates(project);
  const headerCols = [...DPR_FIXED_COLS, ...dates];

  ws.columns = headerCols.map((c) => ({
    width:
      c === "Activity" || c === "Sub Activity"
        ? 28
        : c === "Station / Plant Name" || c === "Sub Partner"
          ? 18
          : 12,
  }));

  // Source row 1 is a "Project daily Activties / date" banner spanning the
  // leading metadata columns; the column header lives on row 2.
  const banner = ws.addRow(
    headerCols.map((_, i) => (i < 8 ? DPR_BANNER : null))
  );
  banner.font = { bold: true, color: { argb: "FF334155" } };

  const header = ws.addRow([...headerCols]);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  });

  project.activities.forEach((a, i) => {
    const cumulative = valueDone(a.entries);
    // COM activities are 100% complete; otherwise derive from cumulative / total.
    const completion = isCompleted(a.entries)
      ? 1
      : activityPct(cumulative, a.totalQty) / 100;

    const row: (string | number | Date | null)[] = [
      i + 1,
      project.gneId,
      project.plantName ?? null,
      project.capacityAcMw ?? null,
      project.subPartner ?? null,
      a.activitySerial ?? null,
      a.activity,
      a.subActivity ?? null,
      a.startDate ?? null,
      a.endDate ?? null,
      a.uom ?? null,
      a.totalQty ?? null,
      cumulative,
      completion,
    ];

    // Per-date cells: COM → "Com", VALUE → number, NONE/absent → blank.
    const byDate = new Map<string, DprEntryLite>();
    for (const e of a.entries) byDate.set(dateKey(e.date), e);
    for (const d of dates) {
      const e = byDate.get(d);
      if (!e) row.push(null);
      else if (e.kind === "COM") row.push("Com");
      else if (e.kind === "VALUE") row.push(e.qtyDone);
      else row.push(null); // NONE
    }

    const r = ws.addRow(row);
    r.getCell(14).numFmt = "0%"; // Completion
    if (r.getCell(9).value instanceof Date) r.getCell(9).numFmt = "yyyy-mm-dd"; // Start
    if (r.getCell(10).value instanceof Date) r.getCell(10).numFmt = "yyyy-mm-dd"; // End
  });

  return ws;
}

export async function buildDprWorkbook(
  project: DprProject
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GNE ERP";
  addDprSheet(wb, project);
  return wb.xlsx.writeBuffer();
}

// ── Full-project workbook ───────────────────────────────────────────────────

// One workbook bundling every available P0 sheet for a single project, in the
// source master-workbook order: Project Details → Activity DPR → BOQ → PO & MRC
// (Materials) → Activities. Each sheet emits its header row even when its data is
// empty, and reuses the exact same builders/mappers as the single-sheet exports
// (addProjectDetailsSheet / addDprSheet / addBoqSheets / addMaterialsSheet /
// addActivitiesSheet) so derived cells stay computed values.

type FullMaterial = {
  partner?: string | null;
  type?: string | null;
  description: string;
  uom?: string | null;
  approvedQty?: number | null;
  receivedQty?: number | null;
  receivedDate?: Date | null;
  deliveryDate?: Date | null;
  mdcc?: string | null;
  signoffBel?: string | null;
  mahagenco?: string | null;
  drawingApproved?: boolean;
  poReleased?: boolean;
  qualitySignoff?: boolean;
  mrcStatus?: string | null;
  paymentStatus?: string | null;
  remarks?: string | null;
};

type FullBoqItem = {
  category: string;
  section: string | null;
  serialNo: string | null;
  description: string;
  rating: string | null;
  specification: string | null;
  uom: string | null;
  quantity: number | null;
  blockQty?: Record<string, number> | null;
  unitRate?: number | null;
  responsibility?: string | null;
};

type FullActivity = DprActivity & { cumulative?: number | null };

type FullProject = ProjectRow &
  DprProject & {
    activities: FullActivity[];
    boqItems?: FullBoqItem[];
    materials?: FullMaterial[];
  };

export async function buildFullProjectWorkbook(
  project: FullProject
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GNE ERP";

  // Source order: Project Details → Activity DPR → BOQ → PO & MRC → Activities.
  addProjectDetailsSheet(wb, [project]);
  addDprSheet(wb, project);
  addBoqSheets(wb, {
    gneId: project.gneId,
    capacityAcMw: project.capacityAcMw,
    capacityDcMw: project.capacityDcMw,
    items: project.boqItems ?? [],
  });
  addMaterialsSheet(wb, { gneId: project.gneId, items: project.materials ?? [] });
  addActivitiesSheet(wb, {
    gneId: project.gneId,
    items: project.activities.map((a) => ({
      activity: a.activity,
      subActivity: a.subActivity,
      uom: a.uom,
      totalQty: a.totalQty,
      // Cumulative done = the same value the DPR/Activities exports compute.
      cumulative: valueDone(a.entries),
    })),
  });

  return wb.xlsx.writeBuffer();
}

// ── Import: parseWorkbook ─────────────────────────────────────────────────────
//
// Reads a full GNE master workbook (the original "Project Details & DPR" file)
// and returns per-project records keyed by a normalized GNE ID, ready for the
// /api/projects/import-workbook route to upsert. Three source sheets are
// recognised — "Project Details", "Activity DPR", "PO & MRC" — by locating their
// hallmark header column, exactly like parseActivitiesWorkbook / parseMaterials-
// Workbook. Every other sheet is ignored (counted as skipped by the route).
//
// Resilience contract: a malformed *row* is skipped and counted, never thrown —
// one bad row can't sink the whole upload. Unreadable *sheets* (no header found)
// are simply not recognised. Cell coercion mirrors the *-excel.ts helpers.

// Cell coercion helpers — copied from the *-excel.ts libs so the parser is
// self-contained (text, number, date, and a "Com"/blank-aware DPR cell reader).
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
  return /^(yes|done|y|true|released|approved)$/.test(t);
}

// Normalize a GNE ID for cross-sheet matching: "GNEI- 0001" / "GNEi-0001" /
// "gnei -0001" all collapse to "GNEI-0001" (uppercase, all whitespace stripped).
export function normalizeGneId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = raw.toUpperCase().replace(/\s+/g, "");
  return n || null;
}

// A DPR per-date cell: "Com" (any case) → COM marker; a number → VALUE; "-" or
// blank → no entry. Returns null to mean "skip this cell".
function readDprCell(
  v: ExcelJS.CellValue
): { kind: "COM" | "VALUE"; qtyDone: number } | null {
  const t = cellText(v);
  if (t === null || t === "-") return null;
  if (/^com$/i.test(t)) return { kind: "COM", qtyDone: 0 };
  const n = cellNum(v);
  if (n === null) return null; // unparseable text in a date cell → skip
  return { kind: "VALUE", qtyDone: n };
}

// ── Parsed shapes returned to the import route ───────────────────────────────

export type ParsedProject = {
  gneId: string; // raw GNE ID as written in Project Details (e.g. "GNEi-0001")
  clientName: string | null;
  tenderId: string | null;
  state: string | null;
  cluster: string | null;
  plantName: string | null;
  capacityAcMw: number | null;
  capacityDcMw: number | null;
  epcScope: string | null;
  poNumber: string | null;
  poValueCr: number | null;
  subPartner: string | null;
  startDate: Date | null;
  liveDate: Date | null;
  completeDate: Date | null;
  handoverDate: Date | null;
  plantAddress: string | null;
  clientAddress: string | null;
};

export type ParsedDprEntry = { date: Date; qtyDone: number; kind: "COM" | "VALUE" };

export type ParsedActivity = {
  activitySerial: number | null;
  activity: string;
  subActivity: string | null;
  uom: string | null;
  totalQty: number | null;
  startDate: Date | null;
  endDate: Date | null;
  entries: ParsedDprEntry[];
};

export type ParsedProcurement = {
  partner: string | null;
  type: string | null;
  description: string;
  uom: string | null;
  approvedQty: number | null;
  receivedQty: number | null;
  receivedDate: Date | null;
  deliveryDate: Date | null;
  drawingApproved: boolean;
  poReleased: boolean;
  qualitySignoff: boolean;
  mrcStatus: string | null;
  paymentStatus: string | null;
  mdcc: string | null;
  signoffBel: string | null;
  mahagenco: string | null;
  remarks: string | null;
};

export type ParseSkips = {
  projectDetails: number;
  activityDpr: number;
  poMrc: number;
  unrecognisedSheets: number;
};

export type ParsedWorkbook = {
  // Project Details records, keyed by *normalized* GNE ID. The raw gneId is kept
  // on each record for display / storage.
  projects: Map<string, ParsedProject>;
  // Child rows keyed by normalized GNE ID so the route can match them to a
  // project even when sheets spell the ID differently ("GNEI- 0001" vs "GNEi-0001").
  activities: Map<string, ParsedActivity[]>;
  procurement: Map<string, ParsedProcurement[]>;
  // Which recognised sheets were actually present.
  sheetsFound: { projectDetails: boolean; activityDpr: boolean; poMrc: boolean };
  skipped: ParseSkips;
};

// Locate the header row in a sheet by a predicate over its lowercased cell texts,
// scanning the first `maxScan` rows (the source header band is rows 1-2, so a
// small window is enough). Returns the row number + a name→column map, or null.
function findHeaderRow(
  ws: ExcelJS.Worksheet,
  matches: (texts: Record<string, number>) => boolean,
  maxScan = 12
): { headerRowNum: number; colMap: Record<string, number> } | null {
  for (let n = 1; n <= Math.min(ws.rowCount, maxScan); n++) {
    const row = ws.getRow(n);
    const texts: Record<string, number> = {};
    row.eachCell((cell, c) => {
      const k = cellText(cell.value)?.toLowerCase();
      if (k && !(k in texts)) texts[k] = c;
    });
    if (matches(texts)) return { headerRowNum: n, colMap: texts };
  }
  return null;
}

// Build a column finder over a header colMap: matches an exact key first, then a
// prefix (so "capacity ( mw) ac" is found by "capacity").
function colFinder(colMap: Record<string, number>) {
  return (...names: string[]): number | undefined => {
    for (const nm of names) {
      if (colMap[nm] !== undefined) return colMap[nm];
      for (const key of Object.keys(colMap)) if (key.startsWith(nm)) return colMap[key];
    }
    return undefined;
  };
}

const get = (
  row: ExcelJS.Row,
  c: number | undefined
): ExcelJS.CellValue => (c ? row.getCell(c).value : null);

// Whether a sheet row has any non-empty cell (used to decide skip-vs-ignore).
function rowHasValues(row: ExcelJS.Row): boolean {
  return row.cellCount > 0 && row.hasValues;
}

// ── Project Details ──────────────────────────────────────────────────────────

function parseProjectDetails(
  ws: ExcelJS.Worksheet,
  out: ParsedWorkbook
): void {
  const found = findHeaderRow(ws, (t) => "gne id" in t);
  if (!found) return;
  out.sheetsFound.projectDetails = true;

  const find = colFinder(found.colMap);
  const cGne = find("gne id");
  if (!cGne) return;

  const cActivity = find("activties", "activities", "activity");
  const cDescription = find("description");
  const cClient = find("client name", "client");
  const cTender = find("tender");
  const cState = find("state");
  const cCluster = find("cluster name", "cluster");
  const cPlant = find("station / plant name", "station", "plant name");
  const cAc = find("capacity ( mw) ac", "capacity ac");
  const cDc = find("capacity ( mw) dc", "capacity dc");
  const cPoNum = find("po number");
  const cPoVal = find("po value");
  const cSubPartner = find("sub partner", "subpartner");
  const cStart = find("start date");
  const cLive = find("live date");
  const cComplete = find("complete date");
  const cHandover = find("handover date");
  const cPlantAddr = find("plant address");
  const cClientAddr = find("bel address", "client address");

  // The source splits scope across "Activties" + "Description"; join them back
  // into a single epcScope string (mirrors splitScope on the export side).
  const joinScope = (a: string | null, d: string | null): string | null => {
    const parts = [a, d].filter((x): x is string => !!x);
    return parts.length ? parts.join(", ") : null;
  };

  for (let n = found.headerRowNum + 1; n <= ws.rowCount; n++) {
    const row = ws.getRow(n);
    const rawGne = cellText(get(row, cGne));
    const key = normalizeGneId(rawGne);
    if (!rawGne || !key) {
      if (rowHasValues(row)) out.skipped.projectDetails++;
      continue;
    }
    out.projects.set(key, {
      gneId: rawGne,
      clientName: cellText(get(row, cClient)),
      tenderId: cellText(get(row, cTender)),
      state: cellText(get(row, cState)),
      cluster: cellText(get(row, cCluster)),
      plantName: cellText(get(row, cPlant)),
      capacityAcMw: cellNum(get(row, cAc)),
      capacityDcMw: cellNum(get(row, cDc)),
      epcScope: joinScope(cellText(get(row, cActivity)), cellText(get(row, cDescription))),
      poNumber: cellText(get(row, cPoNum)),
      poValueCr: cellNum(get(row, cPoVal)),
      subPartner: cellText(get(row, cSubPartner)),
      startDate: cellDate(get(row, cStart)),
      liveDate: cellDate(get(row, cLive)),
      completeDate: cellDate(get(row, cComplete)),
      handoverDate: cellDate(get(row, cHandover)),
      plantAddress: cellText(get(row, cPlantAddr)),
      clientAddress: cellText(get(row, cClientAddr)),
    });
  }
}

// ── Activity DPR ─────────────────────────────────────────────────────────────

function parseActivityDpr(ws: ExcelJS.Worksheet, out: ParsedWorkbook): void {
  // Header row has both "gne id" and "activity"; the per-date columns follow.
  const found = findHeaderRow(ws, (t) => "gne id" in t && "activity" in t);
  if (!found) return;
  out.sheetsFound.activityDpr = true;

  const find = colFinder(found.colMap);
  const cGne = find("gne id");
  const cActivity = find("activity");
  if (!cGne || !cActivity) return;

  const cActSerial = find("activity sl.no", "activity sl");
  const cSub = find("sub activity", "sub-activity", "subactivity");
  const cUom = find("unit", "uom");
  const cTotal = find("total");
  const cStart = find("start date");
  const cEnd = find("end date");

  // Reserved (non-date) leading columns: everything we've named above, plus the
  // known fixed metadata cols. Any header cell that parses to a date *value* —
  // or whose own number-position is past the fixed band — is a per-date column.
  const headerRow = ws.getRow(found.headerRowNum);
  // Map each per-date column index → its Date. A date-column header is a cell
  // that coerces to a valid Date (the source writes them as real dates/strings).
  const dateCols: { col: number; date: Date }[] = [];
  const reservedCols = new Set<number>(
    [
      cGne,
      cActivity,
      cActSerial,
      cSub,
      cUom,
      cTotal,
      cStart,
      cEnd,
      find("sl.no", "sl no"),
      find("station / plant name", "station", "plant name"),
      find("capacity"),
      find("sub partner", "subpartner"),
      find("cumulative"),
      find("completion"),
    ].filter((c): c is number => c !== undefined)
  );
  headerRow.eachCell((cell, c) => {
    if (reservedCols.has(c)) return;
    const d = cellDate(cell.value);
    if (d) dateCols.push({ col: c, date: d });
  });

  for (let n = found.headerRowNum + 1; n <= ws.rowCount; n++) {
    const row = ws.getRow(n);
    const rawGne = cellText(get(row, cGne));
    const key = normalizeGneId(rawGne);
    const activity = cellText(get(row, cActivity));
    if (!key || !activity) {
      if (rowHasValues(row)) out.skipped.activityDpr++;
      continue;
    }

    const entries: ParsedDprEntry[] = [];
    for (const { col, date } of dateCols) {
      const parsed = readDprCell(row.getCell(col).value);
      if (parsed) entries.push({ date, qtyDone: parsed.qtyDone, kind: parsed.kind });
    }

    const list = out.activities.get(key) ?? [];
    list.push({
      activitySerial: cellNum(get(row, cActSerial)),
      activity,
      subActivity: cellText(get(row, cSub)),
      uom: cellText(get(row, cUom)),
      totalQty: cellNum(get(row, cTotal)),
      startDate: cellDate(get(row, cStart)),
      endDate: cellDate(get(row, cEnd)),
      entries,
    });
    out.activities.set(key, list);
  }
}

// ── PO & MRC ─────────────────────────────────────────────────────────────────

function parsePoMrc(ws: ExcelJS.Worksheet, out: ParsedWorkbook): void {
  // Header row carries "project id" and the "desccription" (sic) column.
  const found = findHeaderRow(
    ws,
    (t) => "project id" in t && Object.keys(t).some((k) => k.startsWith("desc"))
  );
  if (!found) return;
  out.sheetsFound.poMrc = true;

  const find = colFinder(found.colMap);
  const cGne = find("project id");
  const cDesc = find("desccription", "description", "desc");
  if (!cGne || !cDesc) return;

  const cPartner = find("partner");
  const cType = find("type");
  const cUom = find("unit", "uom");
  const cApproved = find("approve qty", "approved qty", "approve");
  const cReceivedQty = find("materials recived qty", "received qty", "recived qty");
  const cReceivedDate = find("materials recived date", "received date", "recived date");
  const cDelivery = find("delivery date", "delivery");
  const cDrawing = find("drawing approved", "drawing");
  const cPo = find("po released", "po");
  const cQuality = find("quality team signoff", "quality");
  const cMrc = find("mrc");
  const cPayment = find("payment");
  const cMdcc = find("mdcc");
  const cSignoffBel = find("siginoff bel", "signoff bel", "bel sign");
  const cMahagenco = find("mahagenco");
  const cRemarks = find("remarks");

  for (let n = found.headerRowNum + 1; n <= ws.rowCount; n++) {
    const row = ws.getRow(n);
    const rawGne = cellText(get(row, cGne));
    const key = normalizeGneId(rawGne);
    const description = cellText(get(row, cDesc));
    if (!key || !description) {
      if (rowHasValues(row)) out.skipped.poMrc++;
      continue;
    }

    const list = out.procurement.get(key) ?? [];
    list.push({
      partner: cellText(get(row, cPartner)),
      type: cellText(get(row, cType)),
      description,
      uom: cellText(get(row, cUom)),
      approvedQty: cellNum(get(row, cApproved)),
      receivedQty: cellNum(get(row, cReceivedQty)),
      receivedDate: cellDate(get(row, cReceivedDate)),
      deliveryDate: cellDate(get(row, cDelivery)),
      drawingApproved: cellBool(get(row, cDrawing)),
      poReleased: cellBool(get(row, cPo)),
      qualitySignoff: cellBool(get(row, cQuality)),
      mrcStatus: cellText(get(row, cMrc)),
      paymentStatus: cellText(get(row, cPayment)),
      mdcc: cellText(get(row, cMdcc)),
      signoffBel: cellText(get(row, cSignoffBel)),
      mahagenco: cellText(get(row, cMahagenco)),
      remarks: cellText(get(row, cRemarks)),
    });
    out.procurement.set(key, list);
  }
}

// Recognise a sheet by its header signature (robust to the trailing spaces in the
// source sheet names like "Project Details " / "Activity DPR " / "PO & MRC ").
export async function parseWorkbook(buffer: Buffer): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  const out: ParsedWorkbook = {
    projects: new Map(),
    activities: new Map(),
    procurement: new Map(),
    sheetsFound: { projectDetails: false, activityDpr: false, poMrc: false },
    skipped: { projectDetails: 0, activityDpr: 0, poMrc: 0, unrecognisedSheets: 0 },
  };

  for (const ws of wb.worksheets) {
    const name = (ws.name || "").trim().toLowerCase();
    // Dispatch by sheet name first (cheap + unambiguous for the master workbook),
    // falling through to "unrecognised" for anything else. Each parser independently
    // re-confirms its hallmark header, so a renamed-but-shaped sheet still works.
    if (name.startsWith("project details")) {
      parseProjectDetails(ws, out);
    } else if (name.startsWith("activity dpr")) {
      parseActivityDpr(ws, out);
    } else if (name.startsWith("po & mrc") || name.startsWith("po and mrc")) {
      parsePoMrc(ws, out);
    } else {
      out.skipped.unrecognisedSheets++;
    }
  }

  return out;
}
