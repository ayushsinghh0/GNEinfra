import { cache } from "react";
import { prisma } from "@/lib/prisma";

// Static DEFAULTS for the company details printed on document headers (salary
// slip, tax invoice, NOPA, approval note). Values come from the GNE invoice
// format. Finance can override them from /finance/company — renderers must go
// through getCompany() below, which prefers the edited DB row.
export const COMPANY = {
  name: "Green Next Energy Infra Pvt. Ltd.",
  addressLines: [
    "Flat No. C-3/8, DDA Flat, Near Krishna Cyber Café",
    "New Delhi – 110065, India",
  ],
  pan: "AALCG5876C",
  gstin: "07AALCG5876C1ZD",
  cin: "", // CIN (not on the invoice format — fill when available)
  email: "vinod.saini@gneinfra.com",
  phone: "9958002517",
  bank: {
    name: "HDFC Bank",
    accountNo: "50200102008242",
    ifsc: "HDFC0000483",
  },
} as const;

export type CompanyInfo = {
  name: string;
  addressLines: string[];
  pan: string;
  gstin: string;
  cin: string;
  email: string;
  phone: string;
  bank: { name: string; accountNo: string; ifsc: string };
};

// The DB-backed profile (CompanyProfile singleton, edited at /finance/company)
// with the static defaults as fallback — a fresh DB needs no seed, and a DB
// hiccup degrades to the defaults instead of failing a print page. cache()
// dedupes the query when several parts of one request render the header.
export const getCompany = cache(async (): Promise<CompanyInfo> => {
  const row = await prisma.companyProfile
    .findUnique({ where: { id: "company" } })
    .catch(() => null);
  if (!row) {
    return {
      ...COMPANY,
      addressLines: [...COMPANY.addressLines],
      bank: { ...COMPANY.bank },
    };
  }
  return {
    name: row.name,
    addressLines: row.addressLines
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
    pan: row.pan ?? "",
    gstin: row.gstin ?? "",
    cin: row.cin ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    bank: {
      name: row.bankName ?? "",
      accountNo: row.accountNo ?? "",
      ifsc: row.ifsc ?? "",
    },
  };
});
