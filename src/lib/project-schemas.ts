import { z } from "zod";

// Zod schemas for the Project Management data-entry endpoints.

const str = z.string().trim().max(500).optional().transform((v) => (v ? v : undefined));
const num = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  });
const bool = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => v === true || v === "true" || v === "on");

export const dprEntrySchema = z.object({
  activityId: z.string().min(1, "Pick an activity"),
  date: z.string().min(1, "Date is required"),
  qtyDone: z.coerce.number().refine((n) => Number.isFinite(n), "Quantity is required"),
  note: str,
});

export const activitySchema = z.object({
  activity: z.string().trim().min(1, "Activity name is required").max(200),
  subActivity: str,
  uom: str,
  totalQty: num,
  startDate: str,
  endDate: str,
});

export const boqSchema = z.object({
  category: z.enum(["SUPPLY", "SERVICE", "LINE_WORK"]).default("SUPPLY"),
  section: str,
  serialNo: str,
  description: z.string().trim().min(1, "Description is required").max(300),
  rating: str,
  specification: str,
  uom: str,
  quantity: num,
  responsibility: str,
});

export const milestoneCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  category: str,
  plannedDate: str,
});

export const milestonePatchSchema = z.object({
  milestoneId: z.string().min(1),
  status: z.enum(["PENDING", "IN_PROGRESS", "DONE"]).optional(),
  actualDate: str,
  plannedDate: str,
});

export const materialSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(300),
  type: str,
  partner: str,
  uom: str,
  approvedQty: num,
  receivedQty: num,
  receivedDate: str,
  drawingApproved: bool,
  poReleased: bool,
  qualitySignoff: bool,
  mrcStatus: str,
  remarks: str,
});

export const weatherSchema = z.object({
  date: z.string().min(1, "Date is required"),
  intensity: z.enum(["LIGHT", "MODERATE", "HEAVY"]).default("MODERATE"),
  fromTime: str,
  toTime: str,
  totalHours: num,
  daysImpacted: num,
  note: str,
});

export const approvalSchema = z.object({
  parcel: str,
  block: str,
  item: z.string().trim().min(1, "Item is required").max(200),
  equipment: str,
  capacityUom: str,
  uom: str,
  requiredQty: num,
  receivedQty: num,
  receivedAt: str,
  note: str,
});

export const safetySchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(300),
  unit: str,
  qty: str,
  available: bool,
  remarks: str,
});

// Helper: parse an optional date string -> Date | null (for the routes).
export function toDate(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
