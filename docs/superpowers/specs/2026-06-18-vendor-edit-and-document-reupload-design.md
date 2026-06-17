# Vendor field editing + document re-upload by email

**Date:** 2026-06-18
**Module:** Phase 1 — Vendor Registration
**Status:** Approved (brainstorm)

## Problem

Two gaps in the vendor flow after a vendor has submitted:

1. A vendor may enter something wrong (typo in bank account, wrong GST, etc.).
   There is currently no way for GNE staff to correct a submitted vendor's
   fields — the data is frozen once the form is submitted.
2. An uploaded document may be corrupt or wrong (e.g. an unreadable PDF). There
   is no way to ask that specific vendor to provide a replacement; the original
   invite link is single-use and already consumed.

## Goals

- Admin can edit a vendor's own detail fields (company / statutory / bank)
  directly, at any status including APPROVED.
- Admin can request a fresh copy of a specific document; the vendor receives an
  email with a secure, single-use link to upload just that one file, and the
  corrected file replaces the corrupt one.

## Non-goals

- Editing the vendor's **Past Projects** rows (read-only for now).
- Admin directly uploading a replacement document themselves (the chosen flow is
  email-to-vendor only).
- Any audit log / edit history beyond the existing `updatedAt` timestamp.
- Editing the ERP posting-classification fields (already GNE-only, unused in UI).

---

## Part 1 — Inline editing of vendor fields

### UI

`src/app/admin/vendors/[id]/page.tsx` (server component) currently renders three
static cards — **Company Information**, **Statutory & Tax**, **Bank Details** —
built from a `Row` helper. Replace those three cards with a single **client**
component:

- `src/components/VendorInfoCards.tsx` (`"use client"`).
- Receives the vendor's editable fields as props (plain serializable object).
- Default mode is **view** — renders the same three cards / rows as today.
- An **Edit** button (top of the section) switches to **edit** mode: every row
  becomes a labelled input pre-filled with the current value; **Save** and
  **Cancel** buttons appear.
- **Save** → `PATCH /api/vendors/<id>` with the edited fields as JSON. On
  success, `router.refresh()` and return to view mode. On error, show an inline
  error line (same `ErrorLine` pattern as `VendorStatusActions`).
- **Cancel** → discard local edits, return to view mode.

Editing is allowed at any status; no status gating in the UI.

### Validation

Reuse the client-safe primitives in `src/lib/vendor-validation.ts`
(`validateCompanyName`, `validateEmail`, `validateMobile`, `validateGst`,
`validatePan`, `validateIfsc`, `validateRequired`) to show per-field errors live
and block Save while any required field is invalid. Mandatory fields
(`companyName`, `contactPerson`, `mobileNumber`, `email`, `gstNo`, `panNo`)
remain mandatory — correctable but not blankable. This mirrors the registration
wizard so rules never drift.

### API

New `PATCH` handler in `src/app/api/vendors/[id]/route.ts` (admin-only via
`isAdminAuthed`, matching the existing route style):

- Parse JSON body; validate with a new `vendorEditSchema`.
- `vendorEditSchema` in `src/lib/validation.ts` = the existing
  `registrationSchema` rules for the vendor scalar fields, **without**
  `projects`. Practically: `registrationSchema.omit({ projects: true })`. This
  keeps GST/PAN upper-casing, mobile normalization, and IFSC validation
  identical to registration.
- `prisma.vendor.update({ where: { id }, data: <validated fields> })`; the
  `@updatedAt` column bumps automatically.
- Return `{ ok: true, vendor: <updated> }`; 400 on validation failure, 404 if no
  such vendor, 401 if not admin, 500 on unexpected error.

`PATCH` lives in the same `route.ts` as future vendor-scoped handlers; the
existing status change stays at `/api/vendors/[id]/status`.

---

## Part 2 — Re-request a document by email

### Data model

New Prisma model `DocumentRequest` (migration via `npm run db:migrate`):

```prisma
enum DocumentRequestStatus {
  PENDING
  USED
  EXPIRED
  REVOKED
}

model DocumentRequest {
  id         String                @id @default(cuid())
  token      String                @unique
  vendorId   String
  vendor     Vendor                @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  documentId String?               // the corrupt document being replaced (null if already purged/removed)
  docType    String                // e.g. GST_CERTIFICATE — what the vendor must re-upload
  status     DocumentRequestStatus @default(PENDING)
  expiresAt  DateTime?
  createdAt  DateTime              @default(now())
  fulfilledAt DateTime?

  @@index([vendorId])
  @@index([status])
}
```

Add the inverse relation `documentRequests DocumentRequest[]` to `Vendor`.

### Token generator

Generalize `src/lib/tokens.ts`: keep `newInviteToken()` and add
`newDocumentRequestToken()` (same `randomBytes(24).base64url`), or export a
shared `newToken()` both call. Either is fine; tokens are unguessable + unique.

### Admin action — request a new file

Each document card in `src/app/admin/vendors/[id]/page.tsx` gets a **"Request
new file"** button. Implemented in a small client component (e.g.
`DocumentRequestButton.tsx`, or fold into `VendorInfoCards` siblings) that calls:

`POST /api/vendors/[id]/document-requests` (admin-only), body `{ documentId }`:

1. Look up the document; confirm it belongs to this vendor; read its `docType`
   and the vendor's `email`.
2. Revoke any earlier `PENDING` `DocumentRequest` for the same `documentId`
   (`updateMany` → `REVOKED`) so only one live link exists.
3. Create a `DocumentRequest` with a fresh token, `expiresAt = now + 30 days`.
4. Email the vendor `documentReuploadEmail(link, company, docLabel)` where
   `link = ${APP_BASE_URL}/reupload/<token>`.
5. Return `{ ok: true, emailed: true }`. On SMTP failure, mirror the invites
   route: return `{ ok: true, emailed: false, link, warning }` so the admin can
   share the link manually.

### Email template

Add `documentReuploadEmail(link, company, docLabel)` to `src/lib/mailer.ts`,
following the existing `wrap(...)` house style. Body: "We need a fresh copy of
your **<docLabel>**. Please upload it using the secure link below." + button +
plain link + "valid 30 days, single use".

### Vendor action — public re-upload page

`src/app/reupload/[token]/page.tsx` (server component, public):

- Look up the `DocumentRequest` by token.
- Invalid / not found → friendly "link is invalid" message.
- `USED` → "already submitted". `REVOKED` → "no longer valid".
  `expiresAt < now` → "expired". (Mirror the register-page token states.)
- Valid `PENDING` → render a minimal client upload form naming the document type
  (via the same `DOC_LABELS` map used on the detail page), one file input,
  Submit.

### Vendor action — public upload API

`POST /api/reupload` (public, multipart `token` + single `file`):

1. Re-validate the token (must be `PENDING`, not expired). Reject otherwise with
   the matching status code (409 used, 403 revoked, 410 expired, 404 unknown).
2. Enforce single file + the existing `saveDocument` size/type limits (10 MB,
   PDF/image). Reject oversize/wrong-type up front.
3. In a transaction-like sequence:
   - `saveDocument(vendorId, file)` → store the new file.
   - Create the new `VendorDocument` (same `docType` as the request).
   - **Replace the old:** if `request.documentId` is set, delete the old stored
     file (`deleteDocument`, ignoring `ENOENT`/`NoSuchKey`) and delete the old
     `VendorDocument` row.
   - Mark the `DocumentRequest` `USED`, set `fulfilledAt`.
4. Return `{ ok: true }`; the page shows a success confirmation.

To keep the conditional-update race-safety used elsewhere, flip the request
`PENDING → USED` with an `updateMany` guarded on `status: PENDING`; if it matches
0 rows, another submit already won — return 409 without saving a duplicate.

Security model is identical to the registration invite: no login, protected by
an unguessable, single-use, time-limited token.

---

## Files touched

**New**
- `src/components/VendorInfoCards.tsx` — editable company/statutory/bank cards.
- `src/components/DocumentRequestButton.tsx` — "Request new file" per document.
- `src/app/api/vendors/[id]/route.ts` — `PATCH` vendor edit.
- `src/app/api/vendors/[id]/document-requests/route.ts` — `POST` create request.
- `src/app/api/reupload/route.ts` — `POST` public re-upload.
- `src/app/reupload/[token]/page.tsx` — public re-upload page (+ client form).

**Changed**
- `prisma/schema.prisma` — `DocumentRequest` model + enum + Vendor relation.
- `src/lib/validation.ts` — `vendorEditSchema`.
- `src/lib/tokens.ts` — re-upload token generator.
- `src/lib/mailer.ts` — `documentReuploadEmail`.
- `src/app/admin/vendors/[id]/page.tsx` — swap static cards for `VendorInfoCards`;
  wire the request button into each document card.

## Testing

- **vendorEditSchema**: rejects blank mandatory fields, bad GST/PAN/IFSC;
  upper-cases GST/PAN; normalizes mobile.
- **PATCH /api/vendors/[id]**: 401 unauth, 404 missing, 400 invalid, 200 updates
  and persists.
- **POST document-requests**: creates request + revokes prior pending; 404 for a
  document not belonging to the vendor; emailed=false path on SMTP failure.
- **reupload page**: renders correct state per token status.
- **POST /api/reupload**: rejects expired/used/revoked/unknown token; saves new
  doc, deletes old row + file, marks request USED; double-submit yields 409.
- Manual: edit a vendor end-to-end; request + re-upload a document end-to-end
  against Mailpit.

## Open risks

- `documentId` can dangle if the old document is purged before re-upload; handled
  by treating it as optional and ignoring missing-file deletes.
- Replacing (deleting old) is irreversible — acceptable per decision; the new
  file is the source of truth.
