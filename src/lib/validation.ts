import { z } from "zod";
import {
  GST_RE,
  PAN_RE,
  IFSC_RE,
  isValidIndianMobile,
  normalizeIndianMobile,
} from "@/lib/vendor-validation";

// Indian statutory + mobile formats are defined once in vendor-validation.ts so
// the client wizard and this server schema validate identically.

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
  contactPerson: z.string().trim().min(1, "Contact person is required").max(200),
  mobileNumber: z
    .string()
    .trim()
    .min(1, "Mobile number is required")
    .refine(isValidIndianMobile, "Enter a valid 10-digit Indian mobile number")
    // Store the normalised 10-digit national number.
    .transform((v) => normalizeIndianMobile(v)),
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

// Admin correcting a submitted vendor's own fields. Identical rules to
// registration (GST/PAN upper-cased, mobile normalised, IFSC checked) so the
// edit form and the wizard can never validate differently — minus `projects`,
// which the admin edit screen does not touch.
export const vendorEditSchema = registrationSchema.omit({ projects: true });
export type VendorEditInput = z.infer<typeof vendorEditSchema>;

// Admin sending an invitation. Email is lower-cased so the "one live token per
// address" dedup (and any later correlation) is case-insensitive.
export const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .email("A valid email address is required")
    .transform((v) => v.toLowerCase()),
  companyHint: optionalStr,
});
export type InviteInput = z.infer<typeof inviteSchema>;

// Admin sending a test email.
export const testEmailSchema = z.object({
  to: z.string().trim().email("A valid recipient email is required"),
});

// Admin changing a vendor's review status. INVITED is intentionally excluded —
// it is not a state a submitted vendor can be moved into.
export const vendorStatusSchema = z.object({
  status: z.enum(["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"]),
});
export type VendorStatusInput = z.infer<typeof vendorStatusSchema>;

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
