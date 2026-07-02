// Next-document-number suggestions for the Finance module. Numbers stay
// MANUAL (finance can overwrite while drafting) — these just prefill the
// obvious next value. Numeric max is taken from trailing digits so
// "GNE/25-26/0009" < "GNE/25-26/0010" sorts correctly, mirroring the
// vendorCode assignment pattern.
import { prisma } from "@/lib/prisma";
import { fyShort } from "@/lib/fiscal";

function maxTrailingNumber(values: (string | null)[]): number {
  return values.reduce((max, v) => {
    const m = (v ?? "").match(/(\d+)\s*$/);
    const n = m ? parseInt(m[1], 10) : 0;
    return n > max ? n : max;
  }, 0);
}

export async function nextInvoiceNo(): Promise<string> {
  const rows = await prisma.invoice.findMany({ select: { invoiceNo: true } });
  const next = maxTrailingNumber(rows.map((r) => r.invoiceNo)) + 1;
  return `GNE/${fyShort()}/${String(next).padStart(4, "0")}`;
}

export async function nextNopaNo(): Promise<string> {
  const rows = await prisma.nopa.findMany({ select: { nopaNo: true } });
  const next = maxTrailingNumber(rows.map((r) => r.nopaNo)) + 1;
  return `NOPA/${fyShort()}/${String(next).padStart(4, "0")}`;
}
