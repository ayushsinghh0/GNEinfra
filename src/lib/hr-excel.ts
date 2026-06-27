import ExcelJS from "exceljs";
import type { Employee, PayrollRecord } from "@prisma/client";

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
    "Emp Category",
    "Payroll",
    "Location",
    "Mail Id",
    "Emergency Number",
    "Blood Group",
    "I-Card",
    "DOB",
    "Date of Joining",
    "Offer Letter Date",
    "Leaving Date",
    "Status",
    "Total CTC",
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
    { width: 16 },  // Emp Category
    { width: 14 },  // Payroll
    { width: 16 },  // Location
    { width: 28 },  // Mail Id
    { width: 18 },  // Emergency Number
    { width: 13 },  // Blood Group
    { width: 14 },  // I-Card
    { width: 14 },  // DOB
    { width: 16 },  // Date of Joining
    { width: 18 },  // Offer Letter Date
    { width: 14 },  // Leaving Date
    { width: 10 },  // Status
    { width: 12 },  // Total CTC
    { width: 10 },  // Salary
    { width: 10 },  // LTA
    { width: 18 },  // Special Allowance
    { width: 13 },  // Conveyance
  ];

  const head = ws.addRow(headers);
  boldWhiteHeader(head);

  employees.forEach((emp, idx) => {
    ws.addRow([
      idx + 1,
      emp.empId,
      emp.name,
      emp.designation,
      emp.empCategory ?? "",
      emp.payrollType ?? "",
      emp.location ?? "",
      emp.mailId ?? "",
      emp.emergencyNumber ?? "",
      emp.bloodGroup ?? "",
      emp.iCardNo ?? "",
      fmtDate(emp.dob),
      fmtDate(emp.dateOfJoining),
      fmtDate(emp.offerLetterDate),
      fmtDate(emp.leavingDate),
      emp.status,
      emp.totalCtc ?? "",
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
    "Employee",
    ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1)),
    "P",
    "L",
    "A",
  ];

  ws.columns = [
    { width: 34 },
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
    ws.addRow([`${emp.empId} – ${emp.name}`, ...dayCells, P, L, A]);
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ── 3. Payroll workbook ────────────────────────────────────────────────────────
type PayrollWithEmployee = PayrollRecord & {
  employee: { empId: string; name: string };
};

export async function buildPayrollWorkbook(
  records: PayrollWithEmployee[],
  year: number,
  month: number
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GNE ERP";

  const ws = wb.addWorksheet(`Payroll ${mmYYYY(month, year)}`);

  const headers = [
    "Code",
    "Name",
    "Designation",
    "CTC",
    "Basic",
    "HRA",
    "CCA",
    "Personal Pay",
    "Conveyance",
    "PLA",
    "Medical Reimb",
    "Total Earnings",
    "TDS",
    "Loan Adv",
    "EPF",
    "ESI",
    "Total Ded",
    "Payable",
    "Remarks",
  ];

  ws.columns = [
    { width: 14 },  // Code
    { width: 28 },  // Name
    { width: 20 },  // Designation
    { width: 12 },  // CTC
    { width: 10 },  // Basic
    { width: 10 },  // HRA
    { width: 10 },  // CCA
    { width: 14 },  // Personal Pay
    { width: 13 },  // Conveyance
    { width: 10 },  // PLA
    { width: 15 },  // Medical Reimb
    { width: 15 },  // Total Earnings
    { width: 10 },  // TDS
    { width: 10 },  // Loan Adv
    { width: 10 },  // EPF
    { width: 10 },  // ESI
    { width: 12 },  // Total Ded
    { width: 12 },  // Payable
    { width: 24 },  // Remarks
  ];

  const head = ws.addRow(headers);
  boldWhiteHeader(head);

  for (const r of records) {
    ws.addRow([
      r.code ?? "",
      r.employee.name,
      r.designation ?? "",
      r.ctc ?? "",
      r.basic,
      r.hra,
      r.cca,
      r.personalPay,
      r.conveyance,
      r.pla,
      r.medicalReimb,
      r.totalEarnings,
      r.tds,
      r.loanAdv,
      r.epf,
      r.esi,
      r.totalDeductions,
      r.payableAmount,
      r.remarks ?? "",
    ]);
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
