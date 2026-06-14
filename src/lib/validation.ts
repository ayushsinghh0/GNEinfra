import { z } from "zod";

// Indian statutory formats. Kept reasonably strict but case-insensitive on
// input; we uppercase before validating.
const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const optionalStr = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v === "" ? undefined : v));

// One row of the "Projects Details" table. Fully optional — vendors add as
// many rows as they like, blank rows are dropped server-side.
export const projectSchema = z.object({
  serialNo: z.coerce.number().int().optional(),
  clientName: optionalStr,
  capacity: optionalStr,
  projectType: optionalStr, // Solar / Wind
  contractType: optionalStr, // EPC / I&C / BOS
  location: optionalStr,
  yearOfCompletion: optionalStr,
  scopeOfWork: optionalStr,
  percentCompleted: optionalStr,
  remarks: optionalStr,
});

export const registrationSchema = z.object({
  // Company
  companyName: z.string().trim().min(2, "Company name is required").max(200),
  contactPerson: optionalStr,
  mobileNumber: optionalStr,
  email: z.string().trim().email("A valid email address is required").max(200),
  address: optionalStr,
  state: optionalStr,
  website: optionalStr,
  dateOfIncorporation: optionalStr, // ISO date string from <input type=date>
  yearsOfService: optionalStr,
  annualTurnover: optionalStr,

  // Statutory (GST + PAN mandatory)
  gstNo: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => GST_RE.test(v), "Enter a valid 15-character GST number"),
  panNo: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => PAN_RE.test(v), "Enter a valid 10-character PAN (e.g. ABCDE1234F)"),
  exciseNo: optionalStr,
  tinNo: optionalStr,
  vatLstNo: optionalStr,
  cstNo: optionalStr,
  serviceTaxNo: optionalStr,
  msmeNo: optionalStr,

  // Bank
  bankName: optionalStr,
  bankBranchAddress: optionalStr,
  bankAccountNo: optionalStr,
  bankBranchCode: optionalStr,
  ifscCode: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined))
    .refine((v) => !v || IFSC_RE.test(v), "Enter a valid IFSC code (e.g. HDFC0001234)"),
  swiftCode: optionalStr,
  ibanCode: optionalStr,

  projects: z.array(projectSchema).max(50, "Too many project rows").optional().default([]),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

// Admin sending an invitation.
export const inviteSchema = z.object({
  email: z.string().trim().email("A valid email address is required"),
  companyHint: optionalStr,
});
export type InviteInput = z.infer<typeof inviteSchema>;

// Admin sending a test email.
export const testEmailSchema = z.object({
  to: z.string().trim().email("A valid recipient email is required"),
});

// Creating a project (Phase 2).
const optNum = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  });

export const projectSchemaCreate = z.object({
  gneId: z.string().trim().min(2, "GNE ID is required").max(40),
  clientName: optionalStr,
  tenderId: optionalStr,
  state: optionalStr,
  cluster: optionalStr,
  plantName: optionalStr,
  capacityAcMw: optNum,
  capacityDcMw: optNum,
  epcScope: optionalStr,
  poNumber: optionalStr,
  poValueCr: optNum,
  subPartner: optionalStr,
  vendorId: optionalStr,
  plantAddress: optionalStr,
  clientAddress: optionalStr,
  stage: z
    .enum([
      "PLANNING",
      "ENGINEERING",
      "PROCUREMENT",
      "CONSTRUCTION",
      "TESTING",
      "COMMISSIONING",
      "LIVE",
      "HANDOVER",
      "CLOSED",
    ])
    .optional()
    .default("PLANNING"),
  startDate: optionalStr,
});
export type ProjectCreateInput = z.infer<typeof projectSchemaCreate>;
