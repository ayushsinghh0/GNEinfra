import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getCompany } from "@/lib/company";

// Default Tally ledger names — the export posts to these unless Finance overrides
// them at /finance/tally. They match Tally's out-of-the-box ledger/group names so
// a standard company imports cleanly with zero setup.
export const TALLY_DEFAULTS = {
  salesLedger: "Sales",
  gstLedger: "Output IGST",
  bankLedger: "Bank",
  roundOffLedger: "Round Off",
} as const;

export type TallyLedgers = {
  tallyCompanyName: string; // SVCURRENTCOMPANY
  salesLedger: string;
  gstLedger: string;
  bankLedger: string;
  roundOffLedger: string;
};

// The DB-backed TallySettings singleton merged over TALLY_DEFAULTS — a fresh DB
// needs no seed, and a blank field degrades to its default. The Tally company
// name defaults to the CompanyProfile name (the same company the invoices are
// raised under). cache() dedupes within a request.
export const getTallySettings = cache(async (): Promise<TallyLedgers> => {
  const [row, company] = await Promise.all([
    prisma.tallySettings.findUnique({ where: { id: "tally" } }).catch(() => null),
    getCompany(),
  ]);
  const nz = (v: string | null | undefined, fallback: string) => (v && v.trim() ? v.trim() : fallback);
  return {
    tallyCompanyName: nz(row?.tallyCompanyName, company.name),
    salesLedger: nz(row?.salesLedger, TALLY_DEFAULTS.salesLedger),
    gstLedger: nz(row?.gstLedger, TALLY_DEFAULTS.gstLedger),
    bankLedger: nz(row?.bankLedger, TALLY_DEFAULTS.bankLedger),
    roundOffLedger: nz(row?.roundOffLedger, TALLY_DEFAULTS.roundOffLedger),
  };
});
