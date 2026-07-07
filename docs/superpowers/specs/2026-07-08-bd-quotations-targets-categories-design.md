# BD Enquiries/Quotations + Targets + Project categories — design

**Date:** 2026-07-08
**Status:** Approved (via brainstorming) — single-pass build

## Goals (from the request)

1. **Enquiries & Quotations** — organize into clear Enquiry vs Quotation sections
   (they're already one `BdEnquiry` record); add an **inline "Add client"**; add
   extra enquiry info.
2. **Quotation Management** — a dedicated **quotation-status** field (Pending →
   Quote Preparation → Approval → Quote Submission), plus quote-submission details
   and status tracking.
3. **Target & PO Management** — sales-target vs order-value **achievement tracking**.
4. **Project categories** — Technology (Solar / BESS) × Service (PMC / EPC / I&C /
   O&M), and **quotations categorized project-wise**.

Decisions: build all at once · two dropdowns (Technology + Service, replacing the
free-text `projectType` in the UI) · quotation status is a NEW field alongside the
existing pipeline `stage` · reorganize the record into sections.

## Schema (additive migration; 3 enums + fields)

```prisma
enum BdTechnology { SOLAR BESS }
enum BdServiceCategory { PMC EPC INC OM }          // labels PMC / EPC / I&C / O&M
enum BdQuotationStatus { PENDING QUOTE_PREPARATION APPROVAL QUOTE_SUBMISSION }
```

- **BdEnquiry** += `technology BdTechnology?`, `serviceCategory BdServiceCategory?`,
  `quotationStatus BdQuotationStatus @default(PENDING)`, `submittedTo String?`,
  `quoteValidUntil DateTime? @db.Date`, `quoteRevision String?`,
  `enquirySource String?`, `nextFollowUpDate DateTime? @db.Date`.
  (`projectType` column retained for history; dropped from the form.)
- **BdTarget** += `technology`, `serviceCategory`, `salesTarget Int?` (₹).
  Achievement % = `round(orderReceived / salesTarget * 100)` when `salesTarget > 0`.
- **BdPurchaseOrder** += `technology`, `serviceCategory`.

No columns are dropped (additive only; Neon holds live data).

## Validation — `src/lib/bd-validation.ts`

Add `BD_TECHNOLOGIES`, `BD_SERVICE_CATEGORIES`, `BD_QUOTATION_STATUSES` const lists
+ label maps (`TECHNOLOGY_LABELS`, `SERVICE_CATEGORY_LABELS`,
`QUOTATION_STATUS_LABELS`); extend `enquirySchema`, `targetSchema`, `poSchema` with
the new optional fields (enums via the existing `enumField` optional helper;
`salesTarget` via the money preprocess). Server + client validate identically.

## Status colours — `src/lib/hr-status.ts` (shared registry)

Add quotation-status tones: `PENDING` (exists, amber), `QUOTE_PREPARATION` (blue),
`APPROVAL` (violet), `QUOTE_SUBMISSION` (emerald). One `StatusChip` language.

## UI

### Enquiry form (`EnquiryForm`) — reorganized into fieldset sections
- **Client & Enquiry**: client dropdown **+ inline "＋ Add client"** (opens a small
  form → `POST /api/bd/clients` → the new client is appended and selected, no
  navigation); fiscal year, enquiry date, `enquirySource`, person/contact,
  location, `nextFollowUpDate`, activities, unit/qty.
- **Project category**: Technology + Service dropdowns (replace `projectType`).
- **Quotation**: quote no, `quotationStatus`, `submittedTo`, submission date,
  `quoteValidUntil`, `quoteRevision`, quoted value; pipeline `stage`, probability,
  forecast, expected closure, final status.

### Enquiry detail
Three `DetailSection`s mirroring the form. Header shows pipeline `StatusChip` +
`quotationStatus` chip. Category shown as two chips.

### Enquiries list
Add **Technology / Service / Quotation-status** columns (priority-hidden) and
filter controls (URL params `?technology=&service=&quote=`), composed with the
existing search/stage/final-status filters.

### Targets
- `TargetForm` gains Technology/Service + `salesTarget`.
- Target list/detail shows **achievement**: an `orderReceived / salesTarget` bar +
  `%`. Targets dashboard tile: total sales target vs total order received.

### PO form
Technology/Service dropdowns added.

## Inline "Add client" component

`AddClientInline` (client): a button that reveals a compact form (name required +
optional contact person/number); on submit `POST /api/bd/clients`, then calls back
with the created `{id, name}` so the parent appends it to the client `<select>` and
selects it. Reuses `clientSchema`; BD_WRITE enforced by the existing route.

## RBAC / conventions

BD_VIEW read, BD_WRITE mutate, managers read-only — unchanged, enforced in every
route + `canWrite` in the UI. Enum/status values are not client-settable outside
the Zod whitelist. `onDelete` relations unchanged.

## Verification

`npx tsc --noEmit` + `npm run lint` + `npm run build`. Functional (live/e2e):
create an enquiry with a category + quotation status, add a client inline, set a
target with sales-target and confirm the achievement %.

## Out of scope

HR `Project` model / `/project` stub untouched; quotation-status is a tracked
field, not a gated approval workflow; no PO↔target auto-rollup beyond the target's
own `orderReceived` (kept as entered).
