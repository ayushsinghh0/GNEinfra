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

// One service offering: a category (from the form's fixed list) plus optional
// free-text item details. Vendors add as many rows as they like; rows without a
// category are dropped server-side.
export const serviceSchema = z.object({
  category: z.string().trim().min(1, "Service category is required").max(200),
  item: optionalStr,
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
  country: optionalStr,
  pinCode: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v === "" ? undefined : v))
    .refine((v) => !v || /^[1-9][0-9]{5}$/.test(v), "Enter a valid 6-digit PIN code"),
  website: optionalStr,
  dateOfIncorporation: optionalStr, // ISO date string from <input type=date>
  yearsOfService: optionalStr,
  annualTurnover: optionalStr,

  // Statutory (GST + PAN both optional — gated by the form's toggles; format is
  // checked only when a value is provided).
  gstNo: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined))
    .refine((v) => !v || GST_RE.test(v), "Enter a valid 15-character GST number"),
  panNo: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined))
    .refine((v) => !v || PAN_RE.test(v), "Enter a valid 10-character PAN (e.g. ABCDE1234F)"),
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

  services: z.array(serviceSchema).max(50, "Too many service rows").optional().default([]),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

// Admin correcting a submitted vendor's own fields. Identical rules to
// registration (GST/PAN upper-cased, mobile normalised, IFSC checked) so the
// edit form and the wizard can never validate differently — minus `services`,
// which the admin edit screen does not touch.
export const vendorEditSchema = registrationSchema.omit({ services: true });
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
