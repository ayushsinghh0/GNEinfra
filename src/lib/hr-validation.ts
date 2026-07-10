import { z } from "zod";

export const EMP_CATEGORIES = ["On-Roll", "Contract", "Outsourced", "Intern", "Consultant"] as const;

// Preset departments for Employee.department (a UI convenience — the stored
// value stays a free string via the form's "Other…" input, so custom/legacy
// values keep working).
export const DEPARTMENTS = [
  "Business Development",
  "Supply Chain",
  "Projects",
  "Engineering & Design",
  "Finance & Accounts",
  "HR & Admin",
  "Operations & Maintenance",
] as const;

// Preset job positions offered for an employee's Designation (a UI convenience —
// `designation` stays a free string, so "Other" + legacy values still work).
export const EMPLOYEE_POSITIONS = [
  "Assistant Manager – Solar EPC",
  "Solar Plant Supervisor",
  "Health, Safety & Environment (HSE)",
  "Project Coordinator",
  "Civil Engineer",
  "Electrical Engineer",
  "Supply Chain Manager",
] as const;
export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LEAVE", "SICK", "HALF_DAY", "HOLIDAY", "WEEK_OFF"] as const;
export type AttendanceStatusValue = (typeof ATTENDANCE_STATUSES)[number];

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

// Mark-as-leaving / reactivate action (dedicated endpoint, not the edit form).
export const employeeStatusSchema = z.object({
  action: z.enum(["leave", "reactivate"]),
  leavingDate: z.string().trim().optional().nullable(),
});

// Optional money field: "" / undefined → undefined; otherwise a non-negative integer (rupees).
const money = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().int("Whole rupees only").min(0, "Cannot be negative").optional()
);
// Optional ISO date string → kept as string|undefined (the route converts to Date).
const optDate = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().optional()
);

export const PROJECT_STATUSES = ["ACTIVE", "ON_HOLD", "COMPLETED"] as const;

export const FAMILY_RELATIONS = [
  "Father", "Mother", "Spouse", "Son", "Daughter", "Guardian", "Sibling", "Other",
] as const;

// Optional 0–100 percentage (nominee share): "" / null / undefined → undefined.
const pct = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().int("Whole percent only").min(0).max(100).optional()
);

// One repeatable family / next-of-kin member. Only name + relation are required;
// everything else is optional. Rows are saved as a full replace of the set.
export const familyMemberSchema = z.object({
  name: z.string().trim().min(1, "Family member name is required").max(120),
  relation: z.string().trim().min(1, "Relation is required").max(40),
  dob: optDate,
  gender: z.string().trim().max(20).optional().or(z.literal("")),
  occupation: z.string().trim().max(120).optional().or(z.literal("")),
  contact: z.string().trim().max(20).optional().or(z.literal("")),
  isDependent: z.coerce.boolean().optional(),
  isNominee: z.coerce.boolean().optional(),
  nomineePct: pct,
});
export type FamilyMemberInput = z.infer<typeof familyMemberSchema>;

export const employeeSchema = z.object({
  empId: z.string().trim().min(1, "EMP ID is required").max(40),
  name: z.string().trim().min(1, "Name is required").max(200),
  designation: z.string().trim().min(1, "Designation is required").max(120),
  band: z.string().trim().max(40).optional().or(z.literal("")),
  empCategory: z.string().trim().min(1, "Emp Category is required").max(60),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  dateOfJoining: z.string().min(1, "Date of Joining is required"),
  location: z.string().trim().min(1, "Location is required").max(120),
  payrollType: z.string().trim().max(60).optional().or(z.literal("")),
  mailId: z.string().trim().email("Enter a valid email").max(200).optional().or(z.literal("")),
  emergencyNumber: z.string().trim().max(20).optional().or(z.literal("")),
  bloodGroup: z.string().trim().max(8).optional().or(z.literal("")),
  dob: optDate,
  offerLetterDate: optDate,
  leavingDate: optDate,
  // Bank + statutory live on BOTH this form and /hr/payroll (same columns —
  // last write wins). Pay structure (CTC/salary/deductions) stays payroll-only.
  bankAccountNo: z.string().trim().max(40).optional().or(z.literal("")),
  bankName: z.string().trim().max(120).optional().or(z.literal("")),
  ifsc: z.string().trim().max(11).optional().or(z.literal("")),
  panNo: z.string().trim().max(10).optional().or(z.literal("")),
  uan: z.string().trim().max(20).optional().or(z.literal("")),
  esicNo: z.string().trim().max(20).optional().or(z.literal("")),
  // Family / next-of-kin members — saved as a full replace of the set.
  familyMembers: z.array(familyMemberSchema).max(20).optional(),
});
export type EmployeeInput = z.infer<typeof employeeSchema>;

// Pay structure + bank + statutory + fixed deductions — edited on /hr/payroll,
// NOT on the employee form (so editing an employee never wipes salary set later).
export const payrollSchema = z.object({
  totalCtc: money,
  salary: money,
  lta: money,
  specialAllowance: money,
  conveyance: money,
  bankAccountNo: z.string().trim().max(40).optional().or(z.literal("")),
  bankName: z.string().trim().max(120).optional().or(z.literal("")),
  ifsc: z.string().trim().max(11).optional().or(z.literal("")),
  uan: z.string().trim().max(20).optional().or(z.literal("")),
  panNo: z.string().trim().max(10).optional().or(z.literal("")),
  esicNo: z.string().trim().max(20).optional().or(z.literal("")),
  pfDeduction: money,
  esiDeduction: money,
  tdsDeduction: money,
  otherDeduction: money,
});
export type PayrollInput = z.infer<typeof payrollSchema>;

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

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(160),
  code: z.string().trim().min(1, "Code is required").max(40),
  client: z.string().trim().max(160).optional().or(z.literal("")),
  status: z.enum(PROJECT_STATUSES).default("ACTIVE"),
  startDate: optDate,
  endDate: optDate,
}).refine(
  (d) => !d.startDate || !d.endDate || d.endDate >= d.startDate,
  { message: "End date cannot be before start date", path: ["endDate"] }
);

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
}).refine(
  (d) => !d.endDate || d.endDate >= d.startDate,
  { message: "End date cannot be before start date", path: ["endDate"] }
);
