import { z } from "zod";

export const EMP_CATEGORIES = ["On-Roll", "Contract", "Intern", "Consultant"] as const;
export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LEAVE", "SICK", "HALF_DAY", "HOLIDAY", "WEEK_OFF"] as const;
export type AttendanceStatusValue = (typeof ATTENDANCE_STATUSES)[number];

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

// Optional money field: "" / undefined → undefined; otherwise a non-negative integer (rupees).
const money = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().int("Whole rupees only").min(0, "Cannot be negative").optional()
);
// Required money (payslip components) default 0.
const money0 = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? 0 : v),
  z.coerce.number().int("Whole rupees only").min(0, "Cannot be negative")
);
// Optional ISO date string → kept as string|undefined (the route converts to Date).
const optDate = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().optional()
);

export const PROJECT_STATUSES = ["ACTIVE", "ON_HOLD", "COMPLETED"] as const;

// Annual leave quota: "" / null / undefined → 12; else a non-negative integer.
const quota = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? 12 : v),
  z.coerce.number().int("Whole days only").min(0).max(366)
);

export const employeeSchema = z.object({
  empId: z.string().trim().min(1, "EMP ID is required").max(40),
  name: z.string().trim().min(1, "Name is required").max(200),
  designation: z.string().trim().min(1, "Designation is required").max(120),
  empCategory: z.string().trim().min(1, "Emp Category is required").max(60),
  dateOfJoining: z.string().min(1, "Date of Joining is required"),
  location: z.string().trim().min(1, "Location is required").max(120),
  payrollType: z.string().trim().max(60).optional().or(z.literal("")),
  mailId: z.string().trim().email("Enter a valid email").max(200).optional().or(z.literal("")),
  emergencyNumber: z.string().trim().max(20).optional().or(z.literal("")),
  bloodGroup: z.string().trim().max(8).optional().or(z.literal("")),
  iCardNo: z.string().trim().max(40).optional().or(z.literal("")),
  dob: optDate,
  offerLetterDate: optDate,
  leavingDate: optDate,
  totalCtc: money,
  salary: money,
  lta: money,
  specialAllowance: money,
  conveyance: money,
  casualLeaveQuota: quota,
  sickLeaveQuota: quota,
  bankAccountNo: z.string().trim().max(40).optional().or(z.literal("")),
  bankName: z.string().trim().max(120).optional().or(z.literal("")),
  ifsc: z.string().trim().max(11).optional().or(z.literal("")),
  uan: z.string().trim().max(20).optional().or(z.literal("")),
  panNo: z.string().trim().max(10).optional().or(z.literal("")),
  esicNo: z.string().trim().max(20).optional().or(z.literal("")),
});
export type EmployeeInput = z.infer<typeof employeeSchema>;

export const assetSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  hasLaptop: z.coerce.boolean().optional(),
  lpSerialNo: z.string().trim().max(80).optional().or(z.literal("")),
  makeModel: z.string().trim().max(120).optional().or(z.literal("")),
  lpCategory: z.string().trim().max(60).optional().or(z.literal("")),
  oemName: z.string().trim().max(80).optional().or(z.literal("")),
  laptopBag: z.coerce.boolean().optional(),
  mouse: z.coerce.boolean().optional(),
  charger: z.coerce.boolean().optional(),
  idCard: z.coerce.boolean().optional(),
});

export const attendanceBulkSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  entries: z.array(z.object({
    employeeId: z.string().min(1),
    day: z.coerce.number().int().min(1).max(31),
    status: z.enum(ATTENDANCE_STATUSES),
  })).max(5000),
  clears: z.array(z.object({
    employeeId: z.string().min(1),
    day: z.coerce.number().int().min(1).max(31),
  })).max(5000).optional(),
});

export const PAYROLL_LINE_KINDS = ["earning", "deduction"] as const;
export type PayrollLineKind = (typeof PAYROLL_LINE_KINDS)[number];

// A custom payslip line item: label + integer-rupee amount + earning/deduction.
export const payrollLineSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(60),
  amount: money0,
  kind: z.enum(PAYROLL_LINE_KINDS),
});
export type PayrollExtraLine = z.infer<typeof payrollLineSchema>;

export const payrollSchema = z.object({
  employeeId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  code: z.string().trim().max(40).optional().or(z.literal("")),
  role: z.string().trim().max(120).optional().or(z.literal("")),
  designation: z.string().trim().max(120).optional().or(z.literal("")),
  ctc: money,
  basic: money0, hra: money0, cca: money0, personalPay: money0,
  conveyance: money0, lta: money0, specialAllowance: money0, pla: money0, medicalReimb: money0,
  tds: money0, loanAdv: money0, epf: money0, esi: money0,
  remarks: z.string().trim().max(500).optional().or(z.literal("")),
  extraLines: z.array(payrollLineSchema).max(20).optional(),
});
export type PayrollInput = z.infer<typeof payrollSchema>;

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(160),
  code: z.string().trim().min(1, "Code is required").max(40),
  client: z.string().trim().max(160).optional().or(z.literal("")),
  status: z.enum(PROJECT_STATUSES).default("ACTIVE"),
  startDate: optDate,
  endDate: optDate,
});

export const assignmentSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  projectId: z.string().min(1, "Project is required"),
  roleOnProject: z.string().trim().max(120).optional().or(z.literal("")),
  allocationPct: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().int().min(0).max(100).optional()
  ),
  startDate: z.string().min(1, "Start date is required"),
  endDate: optDate,
});

// Server-authoritative totals — earnings sum, deductions sum, net payable.
export function computePayrollTotals(p: {
  basic: number; hra: number; cca: number; personalPay: number;
  conveyance: number; lta: number; specialAllowance: number; pla: number; medicalReimb: number;
  tds: number; loanAdv: number; epf: number; esi: number;
  extraLines?: { amount: number; kind: PayrollLineKind }[];
}) {
  const extra = p.extraLines ?? [];
  const extraEarnings = extra.filter((l) => l.kind === "earning").reduce((s, l) => s + l.amount, 0);
  const extraDeductions = extra.filter((l) => l.kind === "deduction").reduce((s, l) => s + l.amount, 0);
  const totalEarnings =
    p.basic + p.hra + p.cca + p.personalPay + p.conveyance +
    p.lta + p.specialAllowance + p.pla + p.medicalReimb + extraEarnings;
  const totalDeductions = p.tds + p.loanAdv + p.epf + p.esi + extraDeductions;
  return { totalEarnings, totalDeductions, payableAmount: totalEarnings - totalDeductions };
}
