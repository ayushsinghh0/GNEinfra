# Vendor registration form expansion — Category, Offerings, Experience, POs, Turnover

**Date:** 2026-06-26
**Module:** Phase 1 — Vendor Registration
**Status:** Approved (brainstorm)

## Problem

The current vendor registration captures company info, a flat list of "service"
categories (`VendorService`), statutory/tax numbers, bank details, and document
uploads. GNE procurement needs a richer supplier master that distinguishes
**service** vendors from **product** vendors and captures their **track record**
(experience, purchase orders, turnover) so vendors can be evaluated and matched
to procurement needs.

## Goals

Capture, validate, persist, display (admin), and export the following, extending
the existing pipeline and patterns (not rewriting them):

- **Category** — a vendor is a Service provider and/or a Product supplier (multi-select).
- **Service Activities** (if Service): EPC, BOS, I&C, Other — "Other" carries manual details.
- **Product** (if Product): OEM/Dealer classification + repeatable product rows.
- **Vendor Experience** — last 3 years, structured rows.
- **Purchase Orders (POs)** — structured rows + scanned PO copy uploads.
- **Turnover** — last 3 financial years, structured rows.
- **Statutory** — PAN **required**, GST optional, MSME optional (number + optional certificate).
- **Multi-sheet Excel export** + a sectioned admin detail view.

## Non-goals

- Numeric/typed money fields with reporting math — monetary values are stored as
  free-text `String` (matches the existing `annualTurnover`); can be tightened later.
- Dropping the obsolete pre-GST tax columns (`exciseNo`, `tinNo`, `vatLstNo`,
  `cstNo`, `serviceTaxNo`) — they are removed **from the form only**; DB columns stay.
- MSME Micro/Small/Medium type classification (only the Udyam/MSME number + optional cert).
- Editing the new repeatable rows from the admin edit screen (read-only in admin for now,
  consistent with how `VendorService` rows are read-only there today).
- Reworking auth, storage, rate-limiting, email, or the ERP posting-classification fields.

## Decisions (locked during brainstorm)

| Topic | Decision |
|---|---|
| Category | **Multi-select** — Service and/or Product (≥1 required to submit) |
| Service Activities | Checklist EPC / BOS / I&C / Other; **Other → free-text details** |
| Product | Per-vendor **OEM/Dealer** toggle + **structured product rows** |
| Experience | **Structured rows** (FY, client/project, scope, value) |
| Purchase Orders | **Structured rows + file uploads** (PO copies) |
| Turnover | **Last 3 financial years** as rows (replaces single `annualTurnover` in the form) |
| GST / PAN | **PAN required**, GST optional (format-checked when present) |
| Legacy tax fields | **Removed from the form**, DB columns retained |
| New sections required? | **All optional** except PAN and ≥1 Category |
| Export / admin | **Multi-sheet Excel** + sectioned admin view |

---

## Part 1 — Data model (`prisma/schema.prisma`)

### New columns on `Vendor`

```prisma
offersService Boolean @default(false)  // Category: Service
offersProduct Boolean @default(false)  // Category: Product
oemOrDealer   String?                  // "OEM" | "DEALER" (product vendors)
```

`annualTurnover` and the 5 obsolete tax columns are **kept** (no migration drop)
but are no longer written by the form (turnover moves to `VendorTurnover`).

### Reused — `VendorService` = Service Activities

No schema change. Rows now use `category ∈ {EPC, BOS, "I&C", OTHER}`; for `OTHER`,
`item` holds the manual details (other activities may leave `item` empty). This
reuses the existing persistence, admin Services card, and export rows.

### New related tables

All follow the `VendorService` pattern: `id @default(cuid())`, `vendorId` FK with
`onDelete: Cascade`, `@@index([vendorId])`.

```prisma
model VendorProduct {
  id       String @id @default(cuid())
  vendorId String
  vendor   Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  name     String  // product / category supplied
  brand    String? // make / brand
  model    String?
  @@index([vendorId])
}

model VendorExperience {
  id            String  @id @default(cuid())
  vendorId      String
  vendor        Vendor  @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  financialYear String  // e.g. "FY2023-24"
  clientProject String  // client or project name
  scope         String? // scope of work
  value         String? // order/contract value (free text, e.g. "1.2 Cr")
  @@index([vendorId])
}

model VendorPurchaseOrder {
  id       String    @id @default(cuid())
  vendorId String
  vendor   Vendor    @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  poNumber String?
  client   String?
  value    String?   // free text
  poDate   DateTime?
  @@index([vendorId])
}

model VendorTurnover {
  id            String @id @default(cuid())
  vendorId      String
  vendor        Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  financialYear String // e.g. "FY2023-24"
  amount        String // free text
  @@index([vendorId])
}
```

Add the four back-relations to `Vendor`: `products`, `experiences`,
`purchaseOrders`, `turnovers`.

### Document types

Add `MSME_CERTIFICATE` and `PURCHASE_ORDER` to the docType vocabulary
(`DOC_FIELDS` in `register/route.ts:13`, `DOC_LABELS` in `src/lib/doc-labels.ts:3`,
and the client `DOC_FIELDS` in `RegistrationForm.tsx:271`).

---

## Part 2 — Registration wizard (`src/components/RegistrationForm.tsx`)

Steps go from 5 to **6** (`STEPS` array ~line 203):

1. **Company** — existing fields **+ Category** checkboxes (Service ☐ / Product ☐).
2. **Offerings** *(conditional on Category)*:
   - Service → EPC / BOS / I&C / Other checklist; ticking **Other** reveals a details textarea.
   - Product → OEM/Dealer toggle + repeatable **product rows** (name, brand, model).
3. **Track record** — repeatable **Experience rows** (FY, client/project, scope, value)
   + repeatable **Turnover rows** (FY, amount).
4. **Statutory & Tax** — **PAN (required)**, GST (optional), MSME number (optional).
   Legacy tax inputs removed.
5. **Bank** — unchanged.
6. **Documents** — cancelled cheque, GST cert, PAN, **MSME cert (optional)**,
   **PO copies (multiple)**, other.

### Repeatable rows

Reuse the existing services row mechanism (state array + `updateX(i, field, val)` +
add/remove buttons, `RegistrationForm.tsx:858–910`). New state arrays:
`products`, `experiences`, `turnovers`, `purchaseOrders`, plus `serviceActivities`
(checklist state) and `otherServiceDetails`. Empty rows are filtered before submit
(like `filledServices`).

### Submission (FormData → `/api/register`)

Add JSON-encoded arrays alongside the existing `services` field
(`RegistrationForm.tsx:568–573`): `products`, `experiences`, `turnovers`,
`purchaseOrders`, `serviceActivities`, plus scalars `offersService`,
`offersProduct`, `oemOrDealer`, `otherServiceDetails`. PO copy + MSME cert files
ride as native FormData file fields (`purchaseOrderDocs`, `msmeCertificate`).

### Validation hookup

Per-step `checkFields` gains: PAN required (step 4), ≥1 Category (step 1),
`oemOrDealer` set when Product (step 2). Row-level validation is lenient (blank
rows dropped); only obviously-invalid filled rows error.

---

## Part 3 — Validation (`src/lib/validation.ts`, `src/lib/vendor-validation.ts`)

- `panNo`: change from optional to **required** (`.min(1, "PAN is required")` +
  existing format refine). Remove the client "Has PAN" toggle.
- `gstNo`: unchanged (optional, format-checked when present).
- New zod row schemas, each `.array().max(N).optional().default([])`, blank rows
  dropped server-side (mirrors `serviceSchema`):
  - `productSchema` `{ name (min1), brand?, model? }`
  - `experienceSchema` `{ financialYear (min1), clientProject (min1), scope?, value? }`
  - `purchaseOrderSchema` `{ poNumber?, client?, value?, poDate? (ISO date str) }`
  - `turnoverSchema` `{ financialYear (min1), amount (min1) }`
- New scalars on `registrationSchema`: `offersService`/`offersProduct` (boolean,
  coerced from form strings), `oemOrDealer` (`z.enum(["OEM","DEALER"]).optional()`),
  `otherServiceDetails` (optional), `serviceActivities` (array of `{category,item}`).
- Cross-field refinements: `offersService || offersProduct` must be true;
  `oemOrDealer` present when `offersProduct` true.
- `vendorEditSchema` (admin edit) inherits the PAN-required change; new repeatable
  arrays are **omitted** from it (admin edit doesn't touch them), consistent with
  how `services` is omitted today (`validation.ts:100`).

---

## Part 4 — Server persistence (`src/app/api/register/route.ts`)

- Parse the new JSON arrays + scalars (alongside `services`, ~line 77).
- Extend the `prisma.$transaction` vendor `create` (lines 145–190) with nested
  `create` for `products`, `experiences`, `turnovers`, `purchaseOrders`, and write
  `offersService/offersProduct/oemOrDealer`. Service Activities persist as
  `VendorService` rows (existing nested create). Blank rows already filtered.
- Extend `DOC_FIELDS` (lines 13–18) with `purchaseOrderDocs → PURCHASE_ORDER` and
  `msmeCertificate → MSME_CERTIFICATE`; the existing best-effort document loop
  (lines 212–233) handles them unchanged.

---

## Part 5 — Admin detail view (`src/app/admin/vendors/[id]/page.tsx`)

- Fetch the new relations (`include` products/experiences/turnovers/purchaseOrders).
- Add read-only cards, styled like the existing **Services** card (lines 264–286):
  **Offerings** (category badges + Service Activities chips + Product rows),
  **Experience** (table of rows), **Purchase Orders** (rows + links to the
  uploaded PO docs in the Documents list), **Turnover** (FY/amount rows).
- `VendorInfoCards.tsx` (the editable Company/Statutory/Bank cards) only needs the
  PAN-required tweak and removal of the legacy tax inputs from the Statutory group;
  new repeatable sections are **not** added to inline editing in this iteration.

---

## Part 6 — Excel export (`src/lib/vendor-excel.ts`, multi-sheet)

Refactor the single "Vendor Record" sheet (`buildVendorWorkbook`, lines 12–107)
into multiple worksheets via `wb.addWorksheet(...)`, reusing the existing
`section()`/`kv()` helpers for key-value sheets and a simple header-row + data-row
pattern for table sheets:

| Sheet | Content |
|---|---|
| **Overview** | Company info, Category/OEM-Dealer, Statutory & Tax, Bank (current kv layout) |
| **Services & Products** | Service Activities rows + Product rows |
| **Experience** | FY · Client/Project · Scope · Value |
| **Purchase Orders** | PO No. · Client · Value · Date |
| **Turnover** | FY · Amount |
| **Documents** | Document · File/Status (current layout) |

The export route (`src/app/api/vendors/[id]/export/route.ts`) just needs to fetch
the added relations before calling the builder. The PDF/print page is out of scope
for this iteration unless requested.

---

## Part 7 — Migration & deployment

- One **additive** migration via `npm run db:migrate` (`prisma migrate dev`):
  3 new `Vendor` columns + 4 new tables. **Nothing dropped or renamed** — safe even
  once real vendor data exists (production Neon currently has none).
- `npx prisma generate` to refresh the client.
- Ships through the normal `deploy/redeploy.sh` (runs `prisma migrate deploy`).
- Verification gate: `npm run build` (type-check) + `npm run lint` must pass before
  deploy (no test runner configured).

## Open items to confirm at spec review

1. **Category required?** Default = ≥1 Category required to submit. (Flip to fully
   optional if preferred.)
2. **MSME** = number + optional certificate only (no Micro/Small/Medium type field).
3. **Money as free-text `String`** (e.g. "1.2 Cr") rather than numeric.
4. **PO date** input type = `<input type="date">` (single date per PO).
