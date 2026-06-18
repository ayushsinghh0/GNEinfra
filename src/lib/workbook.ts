import ExcelJS from "exceljs";
import { activityPct, valueDone, isCompleted } from "@/lib/projects";

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

export async function buildProjectDetailsWorkbook(
  projects: ProjectRow[]
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GNE ERP";

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

export async function buildDprWorkbook(
  project: DprProject
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GNE ERP";

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

  return wb.xlsx.writeBuffer();
}
