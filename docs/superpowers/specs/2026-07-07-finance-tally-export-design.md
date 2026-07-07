# Finance → Tally export — design

**Date:** 2026-07-07
**Status:** Approved (via brainstorming)
**Scope:** Export Finance data as Tally-compliant XML for the accountant's native
"Import Data". **Sales + Receipts** in this phase; Purchases deferred (no
vendor-bill data exists yet).

## Approach (chosen)

File-based, one-way export (no live Tally coupling): the ERP generates Tally XML
vouchers; the accountant imports them via Tally's native **Gateway of Tally →
Import Data → Vouchers**. Pros: trivial to ship, accountant keeps manual control
over what posts to the ledgers. Cons: not real-time, relies on the user importing.

Decisions locked in brainstorming:
- **Purchases:** deferred — ship **Sales + Receipts** (the data we actually have).
- **Format:** **Tally XML** only (Tally imports XML natively; Excel is not natively
  importable). `exceljs` stays unused here; XML is templated strings.
- **Ledger mapping:** a **configurable-defaults settings page** — ledger names set
  once; party ledger = the invoice's party name.
- **Records:** **Approved / Paid, by date range** (daily = single date, or monthly).

## Data → voucher mapping

Money is integer rupees; amounts render with 2 decimals (`118000.00`). Dates render
as Tally `YYYYMMDD`. Tally sign convention: **debit = negative AMOUNT +
`ISDEEMEDPOSITIVE=Yes`**, **credit = positive AMOUNT + `ISDEEMEDPOSITIVE=No`**; each
voucher's entries sum to zero.

### Sales Voucher ← `Invoice` where `status = APPROVED` and `invoiceDate ∈ [from, to]`
- Party ledger (debtor) **debit** `total` → `AMOUNT = -total`, deemed-positive Yes
- **Sales** ledger **credit** `subtotal` → `+subtotal`, deemed-positive No
- **GST** ledger **credit** `gstAmount` → `+gstAmount`, deemed-positive No (only if `gstAmount > 0`)
- `VOUCHERTYPENAME=Sales`, `VOUCHERNUMBER=invoiceNo`, `DATE=invoiceDate`,
  `PARTYLEDGERNAME=<party>`, `NARRATION` = order/PO ref + notes.
- Party name = `nopa.partyName` ?? first non-empty line of `billTo`.

### Receipt Voucher ← `Invoice` where `paymentStatus = PAID` and `paymentDate ∈ [from, to]`
- **Bank/Cash** ledger **debit** `total` → `-total`, deemed-positive Yes
- Party ledger **credit** `total` → `+total`, deemed-positive No
- `VOUCHERTYPENAME=Receipt`, `VOUCHERNUMBER=paymentRef ?? invoiceNo`,
  `DATE=paymentDate`, `NARRATION` = "Received against <invoiceNo>" + ref.

Voucher type names `Sales` / `Receipt` are Tally's built-in defaults (not
configurable in this phase — noted as a future toggle).

### Envelope
```
ENVELOPE
  HEADER/TALLYREQUEST = "Import Data"
  BODY/IMPORTDATA
    REQUESTDESC/REPORTNAME = "Vouchers"
    REQUESTDESC/STATICVARIABLES/SVCURRENTCOMPANY = <tally company name>
    REQUESTDATA/TALLYMESSAGE[]  ← one <VOUCHER> per record
```
All text values XML-escaped (`& < > " '`).

## `TallySettings` (new singleton — mirrors `CompanyProfile`/`getCompany()`)

Additive migration. One row; `getTallySettings()` merges the row over hardcoded
defaults so nothing needs seeding.

```
model TallySettings {
  id              String   @id @default("singleton")
  tallyCompanyName String?           // SVCURRENTCOMPANY (defaults to CompanyProfile.name)
  salesLedger     String?            // default "Sales"
  gstLedger       String?            // default "Output IGST"
  bankLedger      String?            // default "Bank"
  roundOffLedger  String?            // default "Round Off" (reserved; unused while totals are exact)
  updatedAt       DateTime @updatedAt
  createdAt       DateTime @default(now())
}
```

`src/lib/tally-settings.ts` → `getTallySettings()` (fallback defaults) +
`TALLY_DEFAULTS`. The Tally company name defaults to `getCompany().name` when unset.

## UI — `/finance/tally` (new page, Finance nav entry)

RSC page, `FINANCE_VIEW` to view. Two cards:
1. **Settings** (write-gated `FINANCE_WRITE`, `canWrite` hides controls for managers):
   a small client form (ledger names + Tally company name) → `PUT /api/finance/tally`.
2. **Export** (client): voucher-type segmented (Sales / Receipts / Both), a
   period control (Daily → a date input; Monthly → a `MonthPicker`), a live
   **preview count** (fetched from the export endpoint with `?preview=1` returning
   `{sales:{count,total}, receipts:{count,total}}`), and a **Download Tally XML**
   button that hits the export endpoint and saves the `.xml`.

Compose existing primitives (`Card`, `Segmented`, `Button`, `Field`, `MonthPicker`,
`PageHeader`, `StatusChip`); "Soft Wave" light styling; no new atmosphere behind data.

## API

- `GET /api/finance/tally/export?type=sales|receipts|both&from=YYYY-MM-DD&to=YYYY-MM-DD[&preview=1]`
  — `FINANCE_VIEW`. Without `preview`: `Content-Type: application/xml` +
  `Content-Disposition: attachment; filename="tally-<type>-<from>_<to>.xml"`. With
  `preview=1`: JSON counts/totals (no file). Validates the date range (Zod);
  `to ≥ from`; caps the range (e.g. ≤ 366 days) to bound the query.
- `PUT /api/finance/tally` — `FINANCE_WRITE`. Zod-validated ledger-name strings
  (trim, max length, non-empty where required). Upserts the singleton.

Both self-guard (`getCurrentUser` + role set), like every other route. Managers are
read-only on settings; the initiator rule is irrelevant here (no approval flow).

## `src/lib/tally.ts` (pure, DB-free)

- `xmlEscape(s)`; `tallyDate(d)`; `money(n)` → `"118000.00"`.
- `salesVoucherXml(inv, party, ledgers)` / `receiptVoucherXml(inv, party, ledgers)`.
- `buildEnvelope(companyName, vouchersXml[])`.
Pure string builders → unit-testable and used by the export route.

## Validation / limitations (documented in the UI)

- **Single combined GST line** → one tax ledger entry (no auto CGST+SGST split).
  Correct for inter-state/IGST; a note warns intra-state users.
- **Party ledgers must exist in Tally** (or Tally auto-creates on import). Names come
  verbatim from the invoice party — inconsistent naming = Tally creates duplicates.
- **Duplicate imports:** vouchers carry `VOUCHERNUMBER`; re-importing the same range
  can double-post. A UI note tells the accountant to import each range once.
- Purchases deferred.

## Verification

- `npx tsc --noEmit` + `npm run lint` + `npm run build`.
- Generate a sample XML from live/demo invoices; sanity-check structure against a
  known Tally voucher-import sample (balanced entries, valid envelope).
- Ideally the accountant test-imports into a **scratch Tally company** before using
  it against the real books.

## Out of scope (future)

Purchases/vendor bills; CGST+SGST split; per-party ledger mapping table; automatic
dedupe/GUIDs; Excel mirror; scheduled/auto export.
