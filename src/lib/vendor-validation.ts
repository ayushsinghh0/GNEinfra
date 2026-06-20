// Shared, client-safe validation primitives for the vendor registration form.
//
// Imported by BOTH the server-side zod schema (src/lib/validation.ts) and the
// client wizard (src/components/RegistrationForm.tsx) so the rules can never
// drift apart. Keep this file free of any server-only imports (no node:*,
// no prisma) — it must run in the browser.

// ── Indian statutory / format patterns ──────────────────────────────────────
export const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
// Indian PIN code: 6 digits, not starting with 0.
export const PIN_RE = /^[1-9][0-9]{5}$/;

// 10-digit Indian mobile: starts 6–9, then 9 more digits.
const MOBILE_10_RE = /^[6-9]\d{9}$/;
// Mirror zod 3's .email() regex exactly so the client never accepts an address
// the server (the authoritative check) would reject — keeps the two in parity.
const EMAIL_RE =
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

// Maximum lengths enforced by the server schema (src/lib/validation.ts). Mirrored
// on the client as input maxLength so over-long input can't reach a server 400.
export const MAX_LEN = { name: 200, email: 200, text: 500 } as const;

// Strip spaces/hyphens/«+» and a leading country (91 / 0091) or trunk (0) code,
// leaving the 10-digit national number. Returns the cleaned digits even when
// invalid so callers can decide how to report it.
export function normalizeIndianMobile(raw: string): string {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 14 && digits.startsWith("0091")) return digits.slice(4);
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function isValidIndianMobile(raw: string): boolean {
  return MOBILE_10_RE.test(normalizeIndianMobile(raw));
}

// ── Per-field validators (return an error message, or null when valid) ───────
export type FieldError = string | null;

export function validateRequired(value: string, label: string): FieldError {
  return value.trim() ? null : `${label} is required`;
}

// Company name mirrors the server's min(2)/max(200) so a 1-char or over-long
// name is caught before submit rather than as a confusing post-confirm 400.
export function validateCompanyName(value: string): FieldError {
  const v = value.trim();
  if (!v) return "Company name is required";
  if (v.length < 2) return "Company name must be at least 2 characters";
  if (v.length > MAX_LEN.name) return `Company name is too long (max ${MAX_LEN.name})`;
  return null;
}

export function validateEmail(value: string): FieldError {
  const v = value.trim();
  if (!v) return "Email address is required";
  return EMAIL_RE.test(v) ? null : "Enter a valid email address";
}

export function validateMobile(value: string): FieldError {
  if (!value.trim()) return "Mobile number is required";
  return isValidIndianMobile(value)
    ? null
    : "Enter a valid 10-digit Indian mobile number (starts 6–9)";
}

// Optional — only validated when the vendor has typed something (the form's
// "Has GST" / "Has PAN" toggles control whether the field is shown at all).
export function validateGst(value: string): FieldError {
  const v = value.trim();
  if (!v) return null;
  return GST_RE.test(v.toUpperCase())
    ? null
    : "Enter a valid 15-character GST number (e.g. 22AAAAA0000A1Z5)";
}

export function validatePan(value: string): FieldError {
  const v = value.trim();
  if (!v) return null;
  return PAN_RE.test(v.toUpperCase())
    ? null
    : "Enter a valid 10-character PAN (e.g. ABCDE1234F)";
}

// Optional — only validated when the vendor has typed something.
export function validateIfsc(value: string): FieldError {
  const v = value.trim();
  if (!v) return null;
  return IFSC_RE.test(v.toUpperCase())
    ? null
    : "Enter a valid IFSC code (e.g. HDFC0001234)";
}

export function validatePin(value: string): FieldError {
  const v = value.trim();
  if (!v) return null;
  return PIN_RE.test(v) ? null : "Enter a valid 6-digit PIN code";
}
