// Human labels for vendor document types. Client-safe (no server imports) so it
// can be used in both server components and client upload UIs.
export const DOC_LABELS: Record<string, string> = {
  CANCELLED_CHEQUE: "Cancelled Cheque",
  GST_CERTIFICATE: "GST Certificate",
  PAN_CARD: "PAN Card",
  OTHER: "Other",
  MSME_CERTIFICATE: "MSME / Udyam Certificate",
  PURCHASE_ORDER: "Purchase Order Copy",
};

export function docLabel(type: string): string {
  return DOC_LABELS[type] ?? type;
}
