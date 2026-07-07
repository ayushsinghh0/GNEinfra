// Pure Tally XML builders (no DB, no framework) for the Finance → Tally export.
// Output is imported via Tally's Gateway → Import Data → Vouchers.
//
// Tally sign convention (the part everyone gets wrong): a DEBIT entry carries a
// NEGATIVE <AMOUNT> and <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>; a CREDIT entry
// carries a POSITIVE <AMOUNT> and <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>. Every
// voucher's entries must sum to zero.

export type TallyLedgersInput = {
  tallyCompanyName: string;
  salesLedger: string;
  gstLedger: string;
  bankLedger: string;
};

export type SalesVoucherInput = {
  voucherNumber: string;
  date: Date;
  party: string;
  subtotal: number; // basic amount (integer rupees)
  gstAmount: number; // combined GST (integer rupees)
  total: number; // subtotal + gstAmount
  narration?: string | null;
};

export type ReceiptVoucherInput = {
  voucherNumber: string;
  date: Date;
  party: string;
  total: number; // amount received (integer rupees)
  narration?: string | null;
};

export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// UTC YYYYMMDD — dates are stored at UTC midnight (@db.Date), so format in UTC to
// avoid a timezone off-by-one.
export function tallyDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

// Integer rupees → "118000.00". Sign is preserved (used for debit negatives).
export function money(n: number): string {
  return n.toFixed(2);
}

function ledgerEntry(name: string, deemedPositive: boolean, amount: number): string {
  return `      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>${xmlEscape(name)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>${deemedPositive ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
        <AMOUNT>${money(amount)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
}

// Sales voucher: party debited the gross, Sales credited the basic, GST credited
// the tax. Party debit is negative (Tally debit sign).
export function salesVoucherXml(v: SalesVoucherInput, l: TallyLedgersInput): string {
  const entries = [
    ledgerEntry(v.party, true, -v.total),
    ledgerEntry(l.salesLedger, false, v.subtotal),
  ];
  if (v.gstAmount > 0) entries.push(ledgerEntry(l.gstLedger, false, v.gstAmount));
  return voucher("Sales", v.voucherNumber, v.date, v.party, v.narration, entries);
}

// Receipt voucher: bank/cash debited (money in, negative), party credited (its
// receivable reduced).
export function receiptVoucherXml(v: ReceiptVoucherInput, l: TallyLedgersInput): string {
  const entries = [
    ledgerEntry(l.bankLedger, true, -v.total),
    ledgerEntry(v.party, false, v.total),
  ];
  return voucher("Receipt", v.voucherNumber, v.date, v.party, v.narration, entries);
}

function voucher(
  type: "Sales" | "Receipt",
  number: string,
  date: Date,
  party: string,
  narration: string | null | undefined,
  entries: string[]
): string {
  const d = tallyDate(date);
  return `    <VOUCHER VCHTYPE="${type}" ACTION="Create">
      <DATE>${d}</DATE>
      <EFFECTIVEDATE>${d}</EFFECTIVEDATE>
      <VOUCHERTYPENAME>${type}</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${xmlEscape(number)}</VOUCHERNUMBER>
      <PARTYLEDGERNAME>${xmlEscape(party)}</PARTYLEDGERNAME>
      <NARRATION>${xmlEscape(narration ?? "")}</NARRATION>
${entries.join("\n")}
    </VOUCHER>`;
}

// Wrap vouchers in the Import Data envelope Tally expects.
export function buildEnvelope(companyName: string, vouchers: string[]): string {
  const messages = vouchers
    .map((v) => `    <TALLYMESSAGE xmlns:UDF="TallyUDF">\n${v}\n    </TALLYMESSAGE>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${xmlEscape(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${messages}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

// Party ledger name from an invoice: prefer the NOPA party, else the first
// non-empty line of the billTo address block. Never empty (Tally needs a name).
export function partyName(nopaPartyName: string | null | undefined, billTo: string): string {
  const p = (nopaPartyName ?? "").trim();
  if (p) return p;
  const firstLine = billTo.split("\n").map((s) => s.trim()).find(Boolean);
  return firstLine || "Unknown Party";
}
