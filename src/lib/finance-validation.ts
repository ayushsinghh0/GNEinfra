import { z } from "zod";

// Finance module Zod — the field whitelist for the invoice → NOPA → approval →
// payment workflow. Status transitions are NEVER client-settable; they happen
// through dedicated endpoints (submit / decision / payment).

export const GST_LABELS = ["IGST", "CGST + SGST", "GST"] as const;
export const INVOICE_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"] as const;
export const PAYMENT_STATUSES = ["UNPAID", "PAID"] as const;

// Required money (integer rupees), "" → 0.
const money0 = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? 0 : v),
  z.coerce.number().int("Whole rupees only").min(0, "Cannot be negative")
);
// Optional ISO date string.
const optDate = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string().optional()
);
const optText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

// GST percent 0–28 (Indian slabs top out at 28).
const gstRate = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? 18 : v),
  z.coerce.number().int().min(0, "0–28").max(28, "0–28")
);

// ── Invoice ───────────────────────────────────────────────────────────────────

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, "Item description is required").max(500),
  sacCode: optText(20),
  qty: z.coerce.number().positive("Qty must be positive").max(1_000_000),
  uom: optText(20),
  rate: money0,
});
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;

export const invoiceSchema = z.object({
  invoiceNo: z.string().trim().min(1, "Invoice number is required").max(40),
  invoiceDate: z.string().min(1, "Invoice date is required"),
  orderNo: optText(60),
  orderDate: optDate,
  contactPerson: optText(120),
  contactNumber: optText(20),
  billTo: z.string().trim().min(1, "Bill-to is required").max(1000),
  shipTo: optText(1000),
  gstLabel: z.enum(GST_LABELS).default("IGST"),
  gstRate,
  notes: optText(1000),
  items: z.array(invoiceItemSchema).min(1, "Add at least one line item").max(30),
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
  description: z.string().trim().min(1, "Line description is required").max(500),
  qtyWords: optText(200),
  uom: optText(20),
  unitPrice: money0,
  amount: money0,
});
export type NopaLineInput = z.infer<typeof nopaLineSchema>;

export const nopaSchema = z.object({
  nopaNo: z.string().trim().min(1, "NOPA number is required").max(40),
  nopaDate: z.string().min(1, "NOPA date is required"),
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
  accountNo: optText(40),
  ifsc: optText(11),
  branchName: optText(120),
  initiatedBy: optText(120),
  checkedBy: optText(120),
  lines: z.array(nopaLineSchema).min(1, "Add at least one line").max(15),
});
export type NopaInput = z.infer<typeof nopaSchema>;

export function computeNopaTotals(lines: { amount: number }[], rate: number) {
  const basicAmount = lines.reduce((s, l) => s + l.amount, 0);
  const gstAmount = Math.round((basicAmount * rate) / 100);
  return { basicAmount, gstAmount, grandTotal: basicAmount + gstAmount };
}

// ── Workflow actions ──────────────────────────────────────────────────────────

export const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  remarks: optText(1000),
});
export type DecisionInput = z.infer<typeof decisionSchema>;

export const paymentSchema = z.object({
  paid: z.boolean(),
  paymentDate: optDate,
  paymentRef: optText(120),
});
export type PaymentInput = z.infer<typeof paymentSchema>;
