import { z } from "zod";
import { GST_RE, PAN_RE } from "./vendor-validation";

// Finance module Zod — the field whitelist for the invoice → NOPA → approval →
// payment workflow. Status transitions are NEVER client-settable; they happen
// through dedicated endpoints (submit / decision / payment).
// These schemas run on BOTH sides: InvoiceForm/NopaForm safeParse before
// submitting (per-field inline errors) and the API routes re-parse as the
// authority. Keep every constraint here so client and server can never drift.

export const GST_LABELS = ["IGST", "CGST + SGST", "GST"] as const;
export const INVOICE_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"] as const;
export const PAYMENT_STATUSES = ["UNPAID", "PAID"] as const;

// Money columns are Postgres `integer` (max 2,147,483,647): cap each money
// field at ₹100 crore and each computed document total at ₹200 crore so the
// math can never overflow the column into a 500.
export const MONEY_MAX = 1_000_000_000;
export const TOTAL_MAX = 2_000_000_000;
export const QTY_MAX = 1_000_000;

// Required money (integer rupees), "" → 0.
const money0 = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? 0 : v),
  z.coerce
    .number({ invalid_type_error: "Numbers only" })
    .int("Whole rupees only — no decimals")
    .min(0, "Cannot be negative")
    .max(MONEY_MAX, "Max ₹100 crore")
);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const realDate = (s: string) => !Number.isNaN(new Date(s).getTime());
const saneYear = (s: string) => {
  const y = Number(s.slice(0, 4));
  return y >= 2000 && y <= 2100;
};
// Date-only strings parse as UTC midnight, so give clients ahead of UTC a
// +36h grace before calling a document date "in the future".
const notFuture = (s: string) => new Date(s).getTime() <= Date.now() + 36 * 60 * 60 * 1000;

// Required document date: real, sane and not post-dated.
const docDate = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .regex(DATE_RE, "Pick a date")
    .refine(realDate, "Not a valid date")
    .refine(saneYear, "Check the year")
    .refine(notFuture, `${label} cannot be in the future`);

// Optional ISO date string — must be a real, sane date when present.
const optDate = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z
    .string()
    .regex(DATE_RE, "Pick a date")
    .refine(realDate, "Not a valid date")
    .refine(saneYear, "Check the year")
    .optional()
);

const optText = (max: number) =>
  z.string().trim().max(max, `Max ${max} characters`).optional().or(z.literal(""));

// Document numbers stay manual (suggestions prefill "GNE/25-26/0001" style) —
// constrain the charset and length, not the exact format.
const docNo = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(40, "Max 40 characters")
    .regex(/^[A-Za-z0-9 ./-]+$/, "Only letters, numbers, spaces and / . -");

// Optional phone: separators allowed, 8–15 digits when present.
const optPhone = z
  .string()
  .trim()
  .max(20, "Max 20 characters")
  .regex(/^[0-9+()\-\s]*$/, "Digits and + ( ) - only")
  .refine((s) => {
    if (!s) return true;
    const digits = s.replace(/\D/g, "").length;
    return digits >= 8 && digits <= 15;
  }, "Enter 8–15 digits")
  .optional();

// SAC/HSN codes are numeric, 4–8 digits.
const optSac = z.string().trim().regex(/^(\d{4,8})?$/, "4–8 digit numeric code").optional();

// Bank fields, shared by the NOPA payee block and the company profile.
const optAccountNo = z.string().trim().regex(/^(\d{9,18})?$/, "9–18 digits").optional();
const optIfsc = z
  .string()
  .trim()
  .regex(/^([A-Za-z]{4}0[A-Za-z0-9]{6})?$/, "11 characters, e.g. HDFC0001234")
  .optional();

// GST percent 0–28 (Indian slabs top out at 28), "" → 18.
const gstRate = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? 18 : v),
  z.coerce
    .number({ invalid_type_error: "Numbers only" })
    .int("Whole % only")
    .min(0, "GST rate must be 0–28")
    .max(28, "GST rate must be 0–28")
);

// ── Invoice ───────────────────────────────────────────────────────────────────

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, "Item description is required").max(500, "Max 500 characters"),
  sacCode: optSac,
  qty: z.coerce
    .number({ invalid_type_error: "Numbers only" })
    .positive("Must be more than 0")
    .max(QTY_MAX, "Max 10,00,000")
    .refine((n) => Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6, "Up to 3 decimal places"),
  uom: optText(20),
  rate: money0,
});
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;

export const invoiceSchema = z
  .object({
    invoiceNo: docNo("Invoice number"),
    invoiceDate: docDate("Invoice date"),
    orderNo: optText(60),
    orderDate: optDate,
    contactPerson: optText(120),
    contactNumber: optPhone,
    billTo: z.string().trim().min(1, "Bill-to is required").max(1000, "Max 1000 characters"),
    shipTo: optText(1000),
    gstLabel: z.enum(GST_LABELS).default("IGST"),
    gstRate,
    notes: optText(1000),
    items: z.array(invoiceItemSchema).min(1, "Add at least one line item").max(30, "Max 30 line items"),
  })
  .superRefine((d, ctx) => {
    // ISO date strings compare correctly as strings.
    if (d.orderDate && d.orderDate > d.invoiceDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["orderDate"],
        message: "Order date cannot be after the invoice date",
      });
    }
    const { subtotal, total } = computeInvoiceTotals(d.items, d.gstRate);
    if (subtotal <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: "Invoice total is ₹0 — enter a rate on at least one line",
      });
    } else if (total > TOTAL_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: "Invoice total exceeds the ₹200 crore limit",
      });
    }
  });
export type InvoiceInput = z.infer<typeof invoiceSchema>;

// Server-authoritative totals: per-item amount = round(qty × rate); GST on the
// subtotal; grand total = subtotal + GST. Integer rupees throughout.
export function computeInvoiceTotals(items: { qty: number; rate: number }[], rate: number) {
  const amounts = items.map((i) => Math.round(i.qty * i.rate));
  const subtotal = amounts.reduce((s, a) => s + a, 0);
  const gstAmount = Math.round((subtotal * rate) / 100);
  return { amounts, subtotal, gstAmount, total: subtotal + gstAmount };
}

// ── NOPA ──────────────────────────────────────────────────────────────────────

export const nopaLineSchema = z.object({
  description: z.string().trim().min(1, "Line description is required").max(500, "Max 500 characters"),
  qtyWords: optText(200),
  uom: optText(20),
  unitPrice: money0,
  amount: money0,
});
export type NopaLineInput = z.infer<typeof nopaLineSchema>;

export const nopaSchema = z
  .object({
    nopaNo: docNo("NOPA number"),
    nopaDate: docDate("NOPA date"),
    companyName: optText(200),
    plantName: optText(300),
    partyName: optText(200),
    itemDescription: optText(500),
    poRef: optText(120),
    gstRate,
    advancePaid: money0,
    advanceRequest: money0,
    dueDate: optDate,
    bankName: optText(120),
    accountNo: optAccountNo,
    ifsc: optIfsc,
    branchName: optText(120),
    initiatedBy: optText(120),
    checkedBy: optText(120),
    lines: z.array(nopaLineSchema).min(1, "Add at least one line").max(15, "Max 15 lines"),
  })
  .superRefine((d, ctx) => {
    if (d.dueDate && d.dueDate < d.nopaDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dueDate"],
        message: "Due date cannot be before the NOPA date",
      });
    }
    const { grandTotal } = computeNopaTotals(d.lines, d.gstRate);
    if (grandTotal <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lines"],
        message: "Grand total is ₹0 — enter an amount on at least one line",
      });
    } else if (grandTotal > TOTAL_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lines"],
        message: "Grand total exceeds the ₹200 crore limit",
      });
    }
    if (grandTotal > 0 && d.advanceRequest > grandTotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["advanceRequest"],
        message: "Cannot exceed the grand total",
      });
    }
  });
export type NopaInput = z.infer<typeof nopaSchema>;

export function computeNopaTotals(lines: { amount: number }[], rate: number) {
  const basicAmount = lines.reduce((s, l) => s + l.amount, 0);
  const gstAmount = Math.round((basicAmount * rate) / 100);
  return { basicAmount, gstAmount, grandTotal: basicAmount + gstAmount };
}

// ── Company profile (the "From" block on every printed document) ─────────────

export const companyProfileSchema = z.object({
  name: z.string().trim().min(2, "Company name is required").max(200, "Max 200 characters"),
  addressLines: z
    .string()
    .trim()
    .min(1, "Address is required")
    .max(500, "Max 500 characters")
    .refine((s) => s.split("\n").filter((l) => l.trim()).length <= 4, "Max 4 address lines"),
  gstin: z
    .string()
    .trim()
    .refine((s) => !s || GST_RE.test(s.toUpperCase()), "15 characters, e.g. 07AALCG5876C1ZD")
    .optional(),
  pan: z
    .string()
    .trim()
    .refine((s) => !s || PAN_RE.test(s.toUpperCase()), "10 characters, e.g. AALCG5876C")
    .optional(),
  cin: z
    .string()
    .trim()
    .max(21, "Max 21 characters")
    .refine((s) => !s || /^[A-Za-z0-9]+$/.test(s), "Letters and digits only")
    .optional(),
  email: z
    .string()
    .trim()
    .max(200, "Max 200 characters")
    .refine((s) => !s || z.string().email().safeParse(s).success, "Enter a valid email")
    .optional(),
  phone: optPhone,
  bankName: optText(120),
  accountNo: optAccountNo,
  ifsc: optIfsc,
});
export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;

// ── Workflow actions ──────────────────────────────────────────────────────────

export const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  remarks: optText(1000),
});
export type DecisionInput = z.infer<typeof decisionSchema>;

export const paymentSchema = z.object({
  paid: z.boolean(),
  paymentDate: optDate.refine(
    (s) => s === undefined || notFuture(s),
    "Payment date cannot be in the future"
  ),
  paymentRef: optText(120),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

// ── Tally export ──────────────────────────────────────────────────────────────

// Ledger-name mapping (all optional — blanks fall back to TALLY_DEFAULTS server-side).
const ledgerName = z.string().trim().max(120).optional().or(z.literal(""));
export const tallySettingsSchema = z.object({
  tallyCompanyName: z.string().trim().max(200).optional().or(z.literal("")),
  salesLedger: ledgerName,
  gstLedger: ledgerName,
  bankLedger: ledgerName,
  roundOffLedger: ledgerName,
});
export type TallySettingsInput = z.infer<typeof tallySettingsSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
// Export request: voucher type + inclusive date range (capped so the query is bounded).
export const tallyExportSchema = z
  .object({
    type: z.enum(["sales", "receipts", "both"]),
    from: isoDate,
    to: isoDate,
    preview: z.enum(["0", "1"]).optional(),
  })
  .refine((d) => d.to >= d.from, { message: "End date must be on or after the start date", path: ["to"] })
  .refine(
    (d) => (Date.parse(d.to) - Date.parse(d.from)) / 86_400_000 <= 366,
    { message: "Date range cannot exceed 366 days", path: ["to"] }
  );
export type TallyExportInput = z.infer<typeof tallyExportSchema>;

// ── API error formatting ──────────────────────────────────────────────────────

// Names the offending field on a schema rejection ("Line 2, rate: …") so the
// API's 400 is actionable even when the client-side parse was bypassed.
export function zodErrorMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input";
  const [head, idx, field] = issue.path;
  if ((head === "items" || head === "lines") && typeof idx === "number") {
    return `Line ${idx + 1}${typeof field === "string" ? `, ${field}` : ""}: ${issue.message}`;
  }
  return typeof head === "string" && head ? `${head}: ${issue.message}` : issue.message;
}
