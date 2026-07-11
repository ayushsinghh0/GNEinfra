import { useSyncExternalStore } from "react";
import type { ZodError } from "zod";

// Client-side form helpers — originally for InvoiceForm/NopaForm; the keystroke
// sanitizers below are shared by HR and BD forms too (strict numeric inputs).

/**
 * Map a ZodError onto the forms' field-error keys: `["items", 2, "rate"]` →
 * `item-2-rate`; top-level paths keep their own key ("invoiceNo", "items").
 */
export function zodFieldErrors(
  error: ZodError,
  rowsKey: "items" | "lines" = "items",
  rowPrefix: "item" | "line" = "item"
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const [head, idx, field] = issue.path;
    const key =
      head === rowsKey && typeof idx === "number" && typeof field === "string"
        ? `${rowPrefix}-${idx}-${field}`
        : typeof head === "string" && head
          ? head
          : "form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/** Local (not UTC) YYYY-MM-DD — for date-input min/max bounds. */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const noopSubscribe = () => () => {};
/** localToday(), but "" during SSR/hydration so server HTML can't disagree. */
export function useLocalToday(): string {
  return useSyncExternalStore(noopSubscribe, localToday, () => "");
}

/* Keystroke sanitizers — invalid characters never enter state. The shared Zod
   schemas (also enforced by the API) stay the submit-time authority. */

/** Digits only, length-capped: money, account numbers, SAC codes, GST %. */
export const digitsOnly = (max: number) => (s: string) => s.replace(/\D/g, "").slice(0, max);

/** Positive decimal, one dot, ≤3 decimal places: quantities. */
export function decimal3(s: string): string {
  let out = s.replace(/[^\d.]/g, "");
  const dot = out.indexOf(".");
  if (dot !== -1) out = out.slice(0, dot + 1) + out.slice(dot + 1).replace(/\./g, "").slice(0, 3);
  return out.slice(0, 12);
}

/** Phone: digits plus common separators. */
export const phoneChars = (s: string) => s.replace(/[^\d+()\-\s]/g, "").slice(0, 20);

/** Document numbers: letters, digits, space and / . - */
export const docNoChars = (s: string) => s.replace(/[^A-Za-z0-9 ./-]/g, "").slice(0, 40);

/** IFSC: alphanumeric → uppercase, 11 chars. */
export const ifscChars = (s: string) =>
  s.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 11);

/** Uppercased alphanumeric, length-capped: GSTIN, PAN, CIN. */
export const upperAlnum = (max: number) => (s: string) =>
  s.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, max);
