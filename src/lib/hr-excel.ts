import ExcelJS from "exceljs";
import type { Employee } from "@prisma/client";

// Short display codes for attendance statuses
const STATUS_CODE: Record<string, string> = {
  PRESENT: "P",
  ABSENT: "A",
  LEAVE: "L",
  HALF_DAY: "H½",
  HOLIDAY: "H",
  WEEK_OFF: "WO",
};

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
  ];

  const head = ws.addRow(headers);
  boldWhiteHeader(head);

  employees.forEach((emp, idx) => {
    // Monthly gross mirrors /hr/payroll's live summary; ×12 sits next to the
    // annual Total CTC so the two are directly comparable in the sheet.
    const gross =
      (emp.salary ?? 0) + (emp.lta ?? 0) + (emp.specialAllowance ?? 0) + (emp.conveyance ?? 0);
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

  const headers = [
    "EMP ID",
    "Employee Name",
    ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1)),
    "P",
    "L",
    "A",
  ];

  ws.columns = [
    { width: 12 },
    { width: 26 },
    ...Array.from({ length: daysInMonth }, () => ({ width: 5 })),
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
      L = 0,
      A = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const raw = dayMap.get(d) ?? "";
      dayCells.push(raw ? (STATUS_CODE[raw] ?? raw) : "");
      if (raw === "PRESENT") P++;
      else if (raw === "LEAVE") L++;
      else if (raw === "ABSENT") A++;
    }
    ws.addRow([emp.empId, emp.name, ...dayCells, P, L, A]);
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
