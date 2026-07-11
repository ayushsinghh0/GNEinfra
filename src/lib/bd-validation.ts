import { z } from "zod";

// Enum value lists (mirror prisma/schema.prisma) + display labels.
export const BD_SERVICE_TYPES = ["EPC", "OM", "EPC_OM"] as const;
export const BD_PLANT_TYPES = ["GROUND", "ROOF", "HYBRID"] as const;
export const BD_STAGES = ["ENQUIRY", "QUOTE_SUBMITTED", "FOLLOW_UP", "NEGOTIATION", "CLOSED"] as const;
export const BD_FINAL_STATUSES = ["OPEN", "WON", "LOST"] as const;
export const BD_QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;
export const BD_TECHNOLOGIES = ["SOLAR", "BESS"] as const;
export const BD_SERVICE_CATEGORIES = ["PMC", "EPC", "INC", "OM"] as const;
export const BD_QUOTATION_STATUSES = ["PENDING", "QUOTE_PREPARATION", "APPROVAL", "QUOTE_SUBMISSION"] as const;

export const TECHNOLOGY_LABELS: Record<(typeof BD_TECHNOLOGIES)[number], string> = {
  SOLAR: "Solar",
  BESS: "BESS",
};
export const SERVICE_CATEGORY_LABELS: Record<(typeof BD_SERVICE_CATEGORIES)[number], string> = {
  PMC: "PMC",
  EPC: "EPC",
  INC: "I&C",
  OM: "O&M",
};
export const QUOTATION_STATUS_LABELS: Record<(typeof BD_QUOTATION_STATUSES)[number], string> = {
  PENDING: "Pending",
  QUOTE_PREPARATION: "Quote preparation",
  APPROVAL: "Approval",
  QUOTE_SUBMISSION: "Quote submission",
};

export const SERVICE_TYPE_LABELS: Record<(typeof BD_SERVICE_TYPES)[number], string> = {
  EPC: "EPC",
  OM: "O&M",
  EPC_OM: "EPC / O&M",
};
export const PLANT_TYPE_LABELS: Record<(typeof BD_PLANT_TYPES)[number], string> = {
  GROUND: "Ground (GBS)",
  ROOF: "Rooftop (RTS)",
  HYBRID: "Hybrid",
};

// ── Shared field preprocessors (same conventions as hr-validation) ───────────

// Optional money: "" / null / undefined → undefined; else non-negative integer rupees.
const money = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number({ invalid_type_error: "Enter digits only (₹)" }).int("Whole rupees only").min(0, "Cannot be negative").optional()
);
// Optional non-negative integer (quantities, location counts).
const optInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number({ invalid_type_error: "Enter digits only" }).int("Whole numbers only").min(0).optional()
);
// Optional 0–100 percentage.
const pct = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number({ invalid_type_error: "Enter digits only (%)" }).int().min(0, "0–100").max(100, "0–100").optional()
);
// Optional ISO date string (routes convert to Date).
const optDate = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().optional()
);
// Optional enum that tolerates "" from a <Select> placeholder.
const optEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), z.enum(values).optional());

const optText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

// ── Schemas ───────────────────────────────────────────────────────────────────

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Client name is required").max(200),
  industry: optText(120),
  serviceType: optEnum(BD_SERVICE_TYPES),
  plantType: optEnum(BD_PLANT_TYPES),
  contactPerson: optText(120),
  contactNumber: optText(20),
  notes: optText(1000),
});
export type ClientInput = z.infer<typeof clientSchema>;

export const enquirySchema = z.object({
  fiscalYear: z.string().trim().min(1, "Fiscal year is required").max(20),
  enquiryDate: optDate,
  enquiryType: optText(60),
  clientId: z.string().min(1, "Client is required"),
  personName: optText(120),
  contactNo: optText(20),
  location: optText(160),
  projectType: optText(120),
  activities: optText(500),
  unit: optText(20),
  qty: optInt,
  quoteNo: optText(60),
  submissionDate: optDate,
  projectStatus: optText(160),
  probabilityPct: pct,
  forecastedRevenue: money,
  stage: z.enum(BD_STAGES).default("ENQUIRY"),
  expectedClosure: optDate,
  finalStatus: z.enum(BD_FINAL_STATUSES).default("OPEN"),
  customerContact: optText(120),
  value: money,
  notes: optText(2000),
  // Project-wise category
  technology: optEnum(BD_TECHNOLOGIES),
  serviceCategory: optEnum(BD_SERVICE_CATEGORIES),
  // Quotation sub-process
  quotationStatus: z.enum(BD_QUOTATION_STATUSES).default("PENDING"),
  submittedTo: optText(160),
  quoteValidUntil: optDate,
  quoteRevision: optText(20),
  // Extra enquiry info
  enquirySource: optText(120),
  nextFollowUpDate: optDate,
});
export type EnquiryInput = z.infer<typeof enquirySchema>;

export const bdPoSchema = z
  .object({
    fiscalYear: z.string().trim().min(1, "Fiscal year is required").max(20),
    receivedDate: optDate,
    projectType: optText(120),
    clientId: z.string().min(1, "Client is required"),
    activities: optText(500),
    quoteNo: optText(60),
    enquiryId: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().optional()),
    projectQty: optText(60),
    projectPeriod: optText(120),
    poNumber: optText(80),
    poValue: money,
    poDate: optDate,
    poStart: optDate,
    poEnd: optDate,
    technology: optEnum(BD_TECHNOLOGIES),
    serviceCategory: optEnum(BD_SERVICE_CATEGORIES),
    remarks: optText(1000),
  })
  .refine((d) => !d.poStart || !d.poEnd || d.poEnd >= d.poStart, {
    message: "PO end date cannot be before its start date",
    path: ["poEnd"],
  });
export type BdPoInput = z.infer<typeof bdPoSchema>;

export const targetSchema = z.object({
  fiscalYear: z.string().trim().min(1, "Fiscal year is required").max(20),
  quarter: optEnum(BD_QUARTERS),
  states: optText(200),
  keyAccountPerson: optText(120),
  project: optText(200),
  serviceType: optEnum(BD_SERVICE_TYPES),
  plantType: optEnum(BD_PLANT_TYPES),
  projectSize: optText(60),
  locations: optInt,
  estimatedValue: money,
  probabilityPct: pct,
  forecastedRevenue: money,
  orderReceived: money,
  salesTarget: money,
  technology: optEnum(BD_TECHNOLOGIES),
  serviceCategory: optEnum(BD_SERVICE_CATEGORIES),
  notes: optText(1000),
});
export type TargetInput = z.infer<typeof targetSchema>;
