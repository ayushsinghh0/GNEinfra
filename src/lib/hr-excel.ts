import ExcelJS from "exceljs";
import type { Employee } from "@prisma/client";
import { STATUS } from "@/components/hr/attendance-status";

// Attendance cell codes come from the shared on-screen status map (single
// source of truth) — the export must show exactly what the calendar shows.
// A hand-rolled copy here once drifted (no SICK code → raw "SICK" in cells).
const statusCode = (raw: string) =>
  (STATUS as Record<string, { code: string }>)[raw]?.code ?? raw;

function mmYYYY(month: number, year: number) {
  return `${String(month).padStart(2, "0")}-${year}`;
}

const fmtDate = (d: Date | null | undefined) =>
  d ? d.toISOString().slice(0, 10) : "";

const boldWhiteHeader = (
  row: ExcelJS.Row,
  fill: string = "FF1E3A5F"
) => {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
};

// ── 1. Employees workbook ──────────────────────────────────────────────────────
export async function buildEmployeesWorkbook(
  employees: Employee[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GNE ERP";

  const ws = wb.addWorksheet("Employees");

  const headers = [
    "S.No",
    "EMP ID",
    "Name",
    "Designation",
    "Band",
    "Department",
    "Emp Category",
    "Payroll Type",
    "Location",
    "Mail Id",
    "Emergency Number",
    "Blood Group",
    "DOB",
    "Date of Joining",
    "Offer Letter Date",
    "Leaving Date",
    "Status",
    "Total CTC",
    "Monthly Gross",
    "Annualised Gross (×12)",
    "Salary",
    "LTA",
    "Special Allowance",
    "Conveyance",
    "PF",
    "ESI",
    "TDS",
    "Other Deduction",
    "Total Deductions",
    "Net / Month",
    "Bank Name",
    "Bank A/C No",
    "IFSC",
    "PAN",
    "UAN",
    "ESIC",
  ];

  ws.columns = [
    { width: 6 },   // S.No
    { width: 14 },  // EMP ID
    { width: 28 },  // Name
    { width: 22 },  // Designation
    { width: 10 },  // Band
    { width: 22 },  // Department
    { width: 16 },  // Emp Category
    { width: 14 },  // Payroll Type
    { width: 16 },  // Location
    { width: 28 },  // Mail Id
    { width: 18 },  // Emergency Number
    { width: 13 },  // Blood Group
    { width: 14 },  // DOB
    { width: 16 },  // Date of Joining
    { width: 18 },  // Offer Letter Date
    { width: 14 },  // Leaving Date
    { width: 10 },  // Status
    { width: 12 },  // Total CTC
    { width: 14 },  // Monthly Gross
    { width: 20 },  // Annualised Gross
    { width: 10 },  // Salary
    { width: 10 },  // LTA
    { width: 18 },  // Special Allowance
    { width: 13 },  // Conveyance
    { width: 10 },  // PF
    { width: 10 },  // ESI
    { width: 10 },  // TDS
    { width: 16 },  // Other Deduction
    { width: 16 },  // Total Deductions
    { width: 13 },  // Net / Month
    { width: 20 },  // Bank Name
    { width: 20 },  // Bank A/C No
    { width: 14 },  // IFSC
    { width: 14 },  // PAN
    { width: 16 },  // UAN
    { width: 16 },  // ESIC
  ];

  const head = ws.addRow(headers);
  boldWhiteHeader(head);

  employees.forEach((emp, idx) => {
    // Monthly gross/deductions/net mirror /hr/payroll's live summary exactly;
    // ×12 sits next to the annual Total CTC so the two are directly comparable.
    const gross =
      (emp.salary ?? 0) + (emp.lta ?? 0) + (emp.specialAllowance ?? 0) + (emp.conveyance ?? 0);
    const deductions =
      (emp.pfDeduction ?? 0) + (emp.esiDeduction ?? 0) + (emp.tdsDeduction ?? 0) + (emp.otherDeduction ?? 0);
    ws.addRow([
      idx + 1,
      emp.empId,
      emp.name,
      emp.designation,
      emp.band ?? "",
      emp.department ?? "",
      emp.empCategory ?? "",
      emp.payrollType ?? "",
      emp.location ?? "",
      emp.mailId ?? "",
      emp.emergencyNumber ?? "",
      emp.bloodGroup ?? "",
      fmtDate(emp.dob),
      fmtDate(emp.dateOfJoining),
      fmtDate(emp.offerLetterDate),
      fmtDate(emp.leavingDate),
      emp.status,
      emp.totalCtc ?? "",
      gross || "",
      gross ? gross * 12 : "",
      emp.salary ?? "",
      emp.lta ?? "",
      emp.specialAllowance ?? "",
      emp.conveyance ?? "",
      emp.pfDeduction ?? "",
      emp.esiDeduction ?? "",
      emp.tdsDeduction ?? "",
      emp.otherDeduction ?? "",
      deductions || "",
      gross ? gross - deductions : "",
      emp.bankName ?? "",
      emp.bankAccountNo ?? "",
      emp.ifsc ?? "",
      emp.panNo ?? "",
      emp.uan ?? "",
      emp.esicNo ?? "",
    ]);
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ── 2. Attendance workbook ─────────────────────────────────────────────────────
type AttEmp = { id: string; empId: string; name: string };
type AttRec = { employeeId: string; date: Date; status: string };

export async function buildAttendanceWorkbook(
  employees: AttEmp[],
  records: AttRec[],
  year: number,
  month: number,
  daysInMonth: number
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GNE ERP";

  const ws = wb.addWorksheet(`Attendance ${mmYYYY(month, year)}`);

  // Summary tallies mirror the on-screen legend: Present / Absent / Leave /
  // Sick / Half-day (sick and half-days used to be silently uncounted).
  const headers = [
    "EMP ID",
    "Employee Name",
    ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1)),
    "P",
    "A",
    "L",
    "S",
    "½",
  ];

  ws.columns = [
    { width: 12 },
    { width: 26 },
    ...Array.from({ length: daysInMonth }, () => ({ width: 5 })),
    { width: 5 },
    { width: 5 },
    { width: 5 },
    { width: 5 },
    { width: 5 },
  ];

  const head = ws.addRow(headers);
  boldWhiteHeader(head);

  // Build lookup: employeeId → (day → raw status)
  const lookup = new Map<string, Map<number, string>>();
  for (const r of records) {
    if (!lookup.has(r.employeeId)) lookup.set(r.employeeId, new Map());
    lookup.get(r.employeeId)!.set(r.date.getUTCDate(), r.status);
  }

  for (const emp of employees) {
    const dayMap = lookup.get(emp.id) ?? new Map<number, string>();
    const dayCells: string[] = [];
    let P = 0,
      A = 0,
      L = 0,
      S = 0,
      H = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const raw = dayMap.get(d) ?? "";
      dayCells.push(raw ? statusCode(raw) : "");
      if (raw === "PRESENT") P++;
      else if (raw === "ABSENT") A++;
      else if (raw === "LEAVE") L++;
      else if (raw === "SICK") S++;
      else if (raw === "HALF_DAY") H++;
    }
    ws.addRow([emp.empId, emp.name, ...dayCells, P, A, L, S, H]);
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
