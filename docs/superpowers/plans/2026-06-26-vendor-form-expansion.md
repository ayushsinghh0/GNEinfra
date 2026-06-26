# Vendor Registration Form Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand vendor registration to capture a Service/Product category split, structured Service Activities & Products, 3-year Experience, Purchase Orders (rows + uploads), 3-year Turnover, make PAN required, and export everything to a multi-sheet Excel workbook.

**Architecture:** Additive Prisma schema (3 new `Vendor` columns + 4 new related tables, reusing the existing `VendorService` table for Service Activities). Shared zod/primitive validation stays the single source of truth for client + server. The 6-step wizard, the register transaction, the admin detail page, and the `exceljs` export are each extended along their existing patterns.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React, Prisma + PostgreSQL (Neon), zod, exceljs, Tailwind v4. Spec: `docs/superpowers/specs/2026-06-26-vendor-form-expansion-design.md`.

## Global Constraints

- **Next.js 16** — read `node_modules/next/dist/docs/` before changing routing/`cookies()`/route handlers; `cookies()`/`headers()` are async. Don't rely on training-data conventions.
- **No test runner is configured.** Per-task verification = `npm run build` (full TypeScript type-check) + `npm run lint`, plus the runtime smoke check named in the task. There are no `*.test.ts` files to write.
- **Validation is one source of truth:** shared primitives in `src/lib/vendor-validation.ts` (client-safe — no `node:*`/prisma imports) feed both the zod server schema (`src/lib/validation.ts`) and the client wizard.
- **Money is free-text `String`** (e.g. "1.2 Cr") — never numeric. Dates use `<input type="date">` → ISO string → `new Date()` server-side.
- **PAN required; GST optional.** GST/PAN format-checked only when present; PAN must be present.
- **Migration is additive only** — new columns + new tables; nothing dropped or renamed. Legacy tax columns (`exciseNo`/`tinNo`/`vatLstNo`/`cstNo`/`serviceTaxNo`) and `annualTurnover` stay in the DB, just leave the form.
- **Local dev DB may be schema-drifted** (see CLAUDE.md). It holds no real data, so resetting it to apply the new migration is safe. Production Neon is correct and gets the migration via `redeploy.sh`.
- **Commit after every task.** Branch `vendor-only`.

## File Structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | 3 `Vendor` columns + 4 new models + back-relations |
| `prisma/migrations/<ts>_vendor_form_expansion/` | Create (generated) | The additive migration |
| `src/lib/vendor-validation.ts` | Modify | Shared constants: `SERVICE_ACTIVITIES`, `OEM_DEALER` |
| `src/lib/validation.ts` | Modify | PAN-required, new row schemas, new scalars/arrays, base-object refactor + refines |
| `src/lib/doc-labels.ts` | Modify | Labels for `MSME_CERTIFICATE`, `PURCHASE_ORDER` |
| `src/app/api/register/route.ts` | Modify | Parse new fields, extend transaction, new docType fields |
| `src/components/RegistrationForm.tsx` | Modify | Category + Offerings + Track-record steps, new repeatable rows, submit encoding |
| `src/app/admin/vendors/[id]/page.tsx` | Modify | Fetch new relations, render new read-only cards |
| `src/components/VendorInfoCards.tsx` | Modify | PAN-required, drop legacy tax inputs |
| `src/lib/vendor-excel.ts` | Modify | Multi-sheet workbook |
| `src/app/api/vendors/[id]/export/route.ts` | Modify | Fetch new relations before building workbook |

---

### Task 1: Schema + additive migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_vendor_form_expansion/migration.sql` (generated)

**Interfaces:**
- Produces: Prisma models `VendorProduct`, `VendorExperience`, `VendorPurchaseOrder`, `VendorTurnover`; `Vendor.offersService: Boolean`, `Vendor.offersProduct: Boolean`, `Vendor.oemOrDealer: String?`, and relations `Vendor.products/experiences/purchaseOrders/turnovers`.

- [ ] **Step 1: Add columns + relations to the `Vendor` model**

In `prisma/schema.prisma`, inside `model Vendor`, add to the company section:
```prisma
  // ── Category (Service and/or Product) ──
  offersService Boolean @default(false)
  offersProduct Boolean @default(false)
  oemOrDealer   String? // "OEM" | "DEALER" — product vendors
```
And add to the `// ── Relations ──` block:
```prisma
  products       VendorProduct[]
  experiences    VendorExperience[]
  purchaseOrders VendorPurchaseOrder[]
  turnovers      VendorTurnover[]
```

- [ ] **Step 2: Add the four new models**

Append after `model VendorService { … }`:
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
  id            String @id @default(cuid())
  vendorId      String
  vendor        Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  financialYear String
  clientProject String
  scope         String?
  value         String?
  @@index([vendorId])
}

model VendorPurchaseOrder {
  id       String    @id @default(cuid())
  vendorId String
  vendor   Vendor    @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  poNumber String?
  client   String?
  value    String?
  poDate   DateTime?
  @@index([vendorId])
}

model VendorTurnover {
  id            String @id @default(cuid())
  vendorId      String
  vendor        Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  financialYear String
  amount        String
  @@index([vendorId])
}
```

- [ ] **Step 3: Validate the schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Create + apply the migration (reset drifted local DB if prompted)**

Run: `npm run db:migrate -- --name vendor_form_expansion`
If Prisma reports drift on the local dev DB, accept the reset (no real local data): the command applies cleanly and regenerates the client.
Expected: a new folder `prisma/migrations/<timestamp>_vendor_form_expansion/` and "Your database is now in sync with your schema."

- [ ] **Step 5: Regenerate the client + type-check**

Run: `npx prisma generate && npm run build`
Expected: build succeeds; `prisma.vendorProduct`, `prisma.vendorExperience`, etc. are now typed.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add category columns + product/experience/PO/turnover tables"
```

---

### Task 2: Shared constants + zod schemas (validation)

**Files:**
- Modify: `src/lib/vendor-validation.ts`
- Modify: `src/lib/validation.ts`

**Interfaces:**
- Consumes: existing `optionalStr`, `serviceSchema`, `GST_RE`, `PAN_RE` from `src/lib/validation.ts`/`vendor-validation.ts`.
- Produces: `SERVICE_ACTIVITIES`, `OEM_DEALER` constants; zod `productSchema`, `experienceSchema`, `purchaseOrderSchema`, `turnoverSchema`; an extended `registrationSchema` (now a refined base object) with fields `offersService`, `offersProduct`, `oemOrDealer`, `otherServiceDetails`, `serviceActivities`, `products`, `experiences`, `purchaseOrders`, `turnovers`; and a `vendorEditSchema` that still type-checks.

- [ ] **Step 1: Add shared constants to `vendor-validation.ts`**

Append to `src/lib/vendor-validation.ts`:
```ts
// Service-activity checklist (replaces the old free-form service categories).
// "Other" reveals a manual-details field; persisted as a VendorService row.
export const SERVICE_ACTIVITIES = ["EPC", "BOS", "I&C", "Other"] as const;
export type ServiceActivity = (typeof SERVICE_ACTIVITIES)[number];

// Product vendors classify themselves once.
export const OEM_DEALER = ["OEM", "DEALER"] as const;
export type OemDealer = (typeof OEM_DEALER)[number];
```

- [ ] **Step 2: Make PAN required + add row schemas + a form-boolean helper in `validation.ts`**

In `src/lib/validation.ts`, replace the existing `panNo` field with:
```ts
  panNo: z
    .string()
    .trim()
    .min(1, "PAN number is required")
    .transform((v) => v.toUpperCase())
    .refine((v) => PAN_RE.test(v), "Enter a valid 10-character PAN (e.g. ABCDE1234F)"),
```
Add, above `registrationSchema`:
```ts
// FormData sends booleans as the strings "true"/"false"; coerce explicitly
// (z.coerce.boolean would treat "false" as true).
const formBool = z.preprocess((v) => v === "true" || v === "1" || v === true, z.boolean());

export const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(200),
  brand: optionalStr,
  model: optionalStr,
});
export const experienceSchema = z.object({
  financialYear: z.string().trim().min(1, "Year is required").max(50),
  clientProject: z.string().trim().min(1, "Client / project is required").max(200),
  scope: optionalStr,
  value: optionalStr,
});
export const purchaseOrderSchema = z.object({
  poNumber: optionalStr,
  client: optionalStr,
  value: optionalStr,
  poDate: optionalStr, // ISO date string from <input type=date>
});
export const turnoverSchema = z.object({
  financialYear: z.string().trim().min(1, "Year is required").max(50),
  amount: z.string().trim().min(1, "Turnover amount is required").max(100),
});
```

- [ ] **Step 3: Refactor `registrationSchema` into a refined base object + add new fields**

Rename the current `export const registrationSchema = z.object({ … })` to `const baseRegistration = z.object({ … })`, **add** these fields inside that object (alongside `services`):
```ts
  offersService: formBool.optional().default(false),
  offersProduct: formBool.optional().default(false),
  oemOrDealer: z.enum(["OEM", "DEALER"]).optional(),
  otherServiceDetails: optionalStr,
  serviceActivities: z.array(serviceSchema).max(20).optional().default([]),
  products: z.array(productSchema).max(100, "Too many product rows").optional().default([]),
  experiences: z.array(experienceSchema).max(50, "Too many experience rows").optional().default([]),
  purchaseOrders: z.array(purchaseOrderSchema).max(100, "Too many PO rows").optional().default([]),
  turnovers: z.array(turnoverSchema).max(10, "Too many turnover rows").optional().default([]),
```
Then define the refined export below the base object:
```ts
export const registrationSchema = baseRegistration
  .refine((d) => d.offersService || d.offersProduct, {
    message: "Select at least one category (Service or Product)",
    path: ["offersService"],
  })
  .refine((d) => !d.offersProduct || !!d.oemOrDealer, {
    message: "Select whether you are an OEM or a Dealer",
    path: ["oemOrDealer"],
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;
```

- [ ] **Step 4: Fix `vendorEditSchema` to omit the new arrays (and keep using the base object)**

`.omit()` does not exist on a refined schema, so point the edit schema at `baseRegistration`:
```ts
export const vendorEditSchema = baseRegistration.omit({
  services: true,
  serviceActivities: true,
  products: true,
  experiences: true,
  purchaseOrders: true,
  turnovers: true,
  offersService: true,
  offersProduct: true,
  oemOrDealer: true,
  otherServiceDetails: true,
});
export type VendorEditInput = z.infer<typeof vendorEditSchema>;
```

- [ ] **Step 5: Type-check + lint**

Run: `npm run build && npm run lint`
Expected: pass. (Build will flag every consumer that must now supply a non-optional PAN / new fields — those are fixed in Tasks 3–5; if the build fails only in `register/route.ts`, that's expected and resolved next. To keep this task green in isolation, it is acceptable for the build to surface errors only in files modified by later tasks; do not "fix" them here by loosening the schema.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/vendor-validation.ts src/lib/validation.ts
git commit -m "feat(validation): PAN required, category + product/experience/PO/turnover schemas"
```

---

### Task 3: Server persistence (register route + doc labels)

**Files:**
- Modify: `src/app/api/register/route.ts`
- Modify: `src/lib/doc-labels.ts`

**Interfaces:**
- Consumes: `registrationSchema` (Task 2), Prisma relations (Task 1), `saveDocument` (`src/lib/documents.ts`).
- Produces: persisted `offersService/offersProduct/oemOrDealer` + nested `services` (activities), `products`, `experiences`, `turnovers`, `purchaseOrders`; new docTypes `PURCHASE_ORDER`, `MSME_CERTIFICATE`.

- [ ] **Step 1: Add doc labels**

In `src/lib/doc-labels.ts`, add to `DOC_LABELS`:
```ts
  MSME_CERTIFICATE: "MSME / Udyam Certificate",
  PURCHASE_ORDER: "Purchase Order Copy",
```

- [ ] **Step 2: Parse the new scalars + JSON arrays**

In `src/app/api/register/route.ts`, where scalar fields and the `services` JSON string are read (~lines 69–90), add a small JSON-array helper and the new reads:
```ts
const parseRows = (key: string): unknown[] => {
  try {
    const raw = form.get(key);
    if (typeof raw !== "string" || !raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

const offersService = form.get("offersService") === "true";
const offersProduct = form.get("offersProduct") === "true";
const oemOrDealer = ((form.get("oemOrDealer") as string) || "").trim() || undefined;
const otherServiceDetails = ((form.get("otherServiceDetails") as string) || "").trim() || undefined;
```
Add these to the object passed to `registrationSchema.safeParse({ … })` (alongside the existing fields and `services`):
```ts
  offersService,
  offersProduct,
  oemOrDealer,
  otherServiceDetails,
  serviceActivities: parseRows("serviceActivities"),
  products: parseRows("products"),
  experiences: parseRows("experiences"),
  purchaseOrders: parseRows("purchaseOrders"),
  turnovers: parseRows("turnovers"),
```

- [ ] **Step 3: Extend the transaction’s `vendor.create`**

In the `prisma.$transaction` (lines 145–190), add `offersService`, `offersProduct`, `oemOrDealer` to the `data`, and replace the single `services: { create: … }` block with all nested creates (drop blank rows just like services are dropped today):
```ts
      offersService: d.offersService,
      offersProduct: d.offersProduct,
      oemOrDealer: d.oemOrDealer ?? null,
      services: {
        create: (d.serviceActivities ?? [])
          .filter((s) => s.category.trim())
          .map((s) => ({ category: s.category.trim(), item: s.item ?? null })),
      },
      products: {
        create: (d.products ?? [])
          .filter((p) => p.name.trim())
          .map((p) => ({ name: p.name.trim(), brand: p.brand ?? null, model: p.model ?? null })),
      },
      experiences: {
        create: (d.experiences ?? [])
          .filter((e) => e.financialYear.trim() && e.clientProject.trim())
          .map((e) => ({
            financialYear: e.financialYear.trim(),
            clientProject: e.clientProject.trim(),
            scope: e.scope ?? null,
            value: e.value ?? null,
          })),
      },
      turnovers: {
        create: (d.turnovers ?? [])
          .filter((t) => t.financialYear.trim() && t.amount.trim())
          .map((t) => ({ financialYear: t.financialYear.trim(), amount: t.amount.trim() })),
      },
      purchaseOrders: {
        create: (d.purchaseOrders ?? [])
          .filter((p) => p.poNumber || p.client || p.value || p.poDate)
          .map((p) => ({
            poNumber: p.poNumber ?? null,
            client: p.client ?? null,
            value: p.value ?? null,
            poDate: p.poDate ? new Date(p.poDate) : null,
          })),
      },
```
Note: `d.serviceActivities` carries the EPC/BOS/I&C/Other rows; for the "Other" row the client puts the manual text into `item`. No separate `otherServiceDetails` column is written (it rides as the Other row’s `item`); the parsed `otherServiceDetails` scalar exists only to satisfy validation symmetry and may be ignored here.

- [ ] **Step 4: Add the new upload fields to `DOC_FIELDS`**

In `DOC_FIELDS` (lines 13–18), add:
```ts
  msmeCertificate: "MSME_CERTIFICATE",
  purchaseOrderDocs: "PURCHASE_ORDER",
```
The existing best-effort upload loop (lines 212–233) handles them with no further change.

- [ ] **Step 5: Type-check + lint**

Run: `npm run build && npm run lint`
Expected: pass (the build error from Task 2’s PAN/required fields in this file is now resolved).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/register/route.ts src/lib/doc-labels.ts
git commit -m "feat(register): persist category, products, experience, POs, turnover + new docs"
```

---

### Task 4: Registration wizard UI

**Files:**
- Modify: `src/components/RegistrationForm.tsx`

**Interfaces:**
- Consumes: `SERVICE_ACTIVITIES`, `OEM_DEALER` (Task 1/2); the `/api/register` contract (Task 3).
- Produces: a 6-step wizard that submits `offersService`, `offersProduct`, `oemOrDealer`, `otherServiceDetails`, and JSON arrays `serviceActivities`, `products`, `experiences`, `purchaseOrders`, `turnovers`, plus files `msmeCertificate`, `purchaseOrderDocs`.

- [ ] **Step 1: Replace the `STEPS` array (5 → 6) and add new row state**

Change `STEPS` (~line 203) to:
```ts
const STEPS = ["Company", "Offerings", "Track record", "Statutory & Tax", "Bank", "Documents"] as const;
```
Add state next to the existing `services` state (lines 81–86 pattern). Define row factories and types mirroring `ServiceRow`/`emptyService()`:
```ts
type ProductRow = { name: string; brand: string; model: string };
type ExperienceRow = { financialYear: string; clientProject: string; scope: string; value: string };
type POrow = { poNumber: string; client: string; value: string; poDate: string };
type TurnoverRow = { financialYear: string; amount: string };
const emptyProduct = (): ProductRow => ({ name: "", brand: "", model: "" });
const emptyExperience = (): ExperienceRow => ({ financialYear: "", clientProject: "", scope: "", value: "" });
const emptyPO = (): POrow => ({ poNumber: "", client: "", value: "", poDate: "" });
const emptyTurnover = (): TurnoverRow => ({ financialYear: "", amount: "" });
```
Inside the component, add `useState` arrays (each initialised to `[emptyX()]`) for `products`, `experiences`, `purchaseOrders`, `turnovers`; scalars `offersService`/`offersProduct` (booleans, default false), `oemOrDealer` (string), `otherServiceDetails` (string), and `serviceActivities` (a `Set<string>` or boolean map keyed by `SERVICE_ACTIVITIES`). Add matching `updateX(i, field, val)` and add/remove handlers mirroring `updateService`/`setServices` (lines 858–910).

- [ ] **Step 2: Step 0 (Company) — add the Category checkboxes**

At the end of the Company step JSX, add a Category block: two checkboxes bound to `offersService`/`offersProduct` using the existing field/label styling. Show an inline error (reuse the `stepError` pattern) if the user advances with neither ticked.

- [ ] **Step 3: Step 1 (Offerings) — conditional Service + Product sections**

Render only when its category is ticked:
- If `offersService`: a checklist over `SERVICE_ACTIVITIES` (EPC/BOS/I&C/Other) toggling membership in `serviceActivities`. When "Other" is checked, render a textarea bound to `otherServiceDetails`.
- If `offersProduct`: an OEM/Dealer segmented control bound to `oemOrDealer` (values from `OEM_DEALER`), then repeatable product rows (`name`, `brand`, `model`) using the exact services-row add/remove pattern (lines 858–910), labels "Product / Category", "Make / Brand", "Model".

- [ ] **Step 4: Step 2 (Track record) — Experience + Turnover rows**

Two repeatable-row groups using the same pattern:
- Experience rows: `financialYear` (text, placeholder "FY2023-24"), `clientProject`, `scope`, `value` (₹).
- Turnover rows: `financialYear`, `amount` (₹). Cap visually at 3 rows of guidance text ("last 3 financial years") but do not hard-block extra rows.

- [ ] **Step 5: Step 3 (Statutory) — PAN required, GST optional, drop legacy fields**

Remove the Excise/TIN/VAT/CST/Service-Tax inputs from this step. Keep GST behind its existing optional toggle. Make PAN **always shown and required** (remove the "Has PAN" toggle; wire `validatePan` to also reject empty — block "Next" when PAN is blank or invalid). Keep MSME number as an optional input.

- [ ] **Step 6: Step 5 (Documents) — add MSME cert + PO copies dropzones**

Add two Dropzone fields next to the existing ones (lines 917–927 pattern): `msmeCertificate` (single, optional) and `purchaseOrderDocs` (multiple, optional). Reuse `ALLOWED_DOC_TYPES`/`MAX_DOC_BYTES` validation.

- [ ] **Step 7: Submission — encode the new fields into FormData**

Where the FormData is assembled (lines 568–574), after `fd.set("services", …)` add:
```ts
fd.set("offersService", String(offersService));
fd.set("offersProduct", String(offersProduct));
if (oemOrDealer) fd.set("oemOrDealer", oemOrDealer);
if (otherServiceDetails.trim()) fd.set("otherServiceDetails", otherServiceDetails.trim());
// Service activities become {category,item} rows; "Other" carries its details as item.
fd.set("serviceActivities", JSON.stringify(
  [...serviceActivities].map((a) => ({ category: a, item: a === "Other" ? otherServiceDetails : "" }))
));
fd.set("products", JSON.stringify(products.filter((p) => p.name.trim())));
fd.set("experiences", JSON.stringify(experiences.filter((e) => e.financialYear.trim() && e.clientProject.trim())));
fd.set("purchaseOrders", JSON.stringify(purchaseOrders.filter((p) => p.poNumber || p.client || p.value || p.poDate)));
fd.set("turnovers", JSON.stringify(turnovers.filter((t) => t.financialYear.trim() && t.amount.trim())));
```
Keep the `services` field too (now empty/unused) OR repurpose it — simplest: stop sending `services` and send `serviceActivities` instead; the server reads both, so leaving `services` unset is fine.

- [ ] **Step 8: Update step-error routing**

Extend `applyServerIssues()` (lines 535–560) field→step map so `offersService`/`oemOrDealer` route to their steps, and `panNo` routes to the Statutory step.

- [ ] **Step 9: Type-check, lint, runtime smoke**

Run: `npm run build && npm run lint`
Then runtime: start docker (`docker compose up -d`), point the dev server at a freshly-migrated local DB, `npm run dev`, open a valid `/register/<token>`, fill one row in each section, submit, and confirm `{ ok: true }` and that the new rows landed (check Prisma Studio: `npm run db:studio`).
Expected: vendor + product/experience/PO/turnover rows created; PAN blank is blocked client-side.

- [ ] **Step 10: Commit**

```bash
git add src/components/RegistrationForm.tsx
git commit -m "feat(form): 6-step wizard — category, offerings, track record, PAN required"
```

---

### Task 5: Admin detail view

**Files:**
- Modify: `src/app/admin/vendors/[id]/page.tsx`
- Modify: `src/components/VendorInfoCards.tsx`

**Interfaces:**
- Consumes: new Vendor relations (Task 1).
- Produces: read-only admin cards for Offerings / Experience / Purchase Orders / Turnover; PAN-required + legacy-tax-free edit cards.

- [ ] **Step 1: Fetch the new relations**

In `page.tsx`, extend the Prisma query (`include`) for the vendor to add `products: true, experiences: true, purchaseOrders: true, turnovers: true` (services/documents already included).

- [ ] **Step 2: Render new read-only cards**

After the existing **Services** card (lines 264–286), add four `<Card>`s mirroring its structure:
- **Offerings:** category badges ("Service"/"Product" from `offersService`/`offersProduct`), `oemOrDealer` chip, and product rows (`name` — `brand` — `model`).
- **Experience:** rows `financialYear · clientProject · scope · value`.
- **Purchase Orders:** rows `poNumber · client · value · fmtDate(poDate)`; PO copy files already appear in the Documents card via docType `PURCHASE_ORDER`.
- **Turnover:** rows `financialYear · amount`.
Use the existing `Chip`, `fmtDate`, and card styling; show "—" for empty optionals.

- [ ] **Step 3: VendorInfoCards — PAN required, drop legacy tax inputs**

In `src/components/VendorInfoCards.tsx`, remove `exciseNo`/`tinNo`/`vatLstNo`/`cstNo`/`serviceTaxNo` from the STATUTORY field group (lines ~114–146) so the admin edit form no longer shows them; keep `gstNo`, `panNo`, `msmeNo`. Mark `panNo` required in its validator usage (block Save when blank), matching the wizard.

- [ ] **Step 4: Type-check, lint, runtime smoke**

Run: `npm run build && npm run lint`
Then open `/admin/vendors/<id>` for the vendor created in Task 4 and confirm the four new cards render with the entered data, and the edit form no longer shows legacy tax fields.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/vendors/[id]/page.tsx src/components/VendorInfoCards.tsx
git commit -m "feat(admin): vendor cards for offerings/experience/POs/turnover; PAN-required edit"
```

---

### Task 6: Multi-sheet Excel export

**Files:**
- Modify: `src/lib/vendor-excel.ts`
- Modify: `src/app/api/vendors/[id]/export/route.ts`

**Interfaces:**
- Consumes: new Vendor relations (Task 1).
- Produces: a workbook with sheets Overview, Services & Products, Experience, Purchase Orders, Turnover, Documents.

- [ ] **Step 1: Fetch relations in the export route**

In `export/route.ts`, extend the vendor `include` to add `products`, `experiences`, `purchaseOrders`, `turnovers` (services/documents already fetched).

- [ ] **Step 2: Add a table-sheet helper + split into sheets**

In `src/lib/vendor-excel.ts`, keep the existing `section()`/`kv()` helpers for the **Overview** sheet (Company + Category/OEM-Dealer + Statutory + Bank). Add a small helper to build a table sheet:
```ts
const tableSheet = (title: string, headers: string[], rows: (string | null | undefined)[][]) => {
  const ws = wb.addWorksheet(title);
  ws.columns = headers.map(() => ({ width: 28 }));
  const head = ws.addRow(headers);
  head.font = { bold: true };
  for (const r of rows) ws.addRow(r.map((c) => (c && String(c).trim() ? String(c) : "—")));
};
```
Then, before `wb.xlsx.writeBuffer()`, add:
```ts
tableSheet("Services & Products",
  ["Type", "Category / Activity", "Brand / Item", "Model"],
  [
    ...v.services.map((s) => ["Service", s.category, s.item, ""]),
    ...v.products.map((p) => ["Product", p.name, p.brand, p.model]),
  ]);
tableSheet("Experience",
  ["Financial Year", "Client / Project", "Scope", "Value"],
  v.experiences.map((e) => [e.financialYear, e.clientProject, e.scope, e.value]));
tableSheet("Purchase Orders",
  ["PO Number", "Client", "Value", "Date"],
  v.purchaseOrders.map((p) => [p.poNumber, p.client, p.value, p.poDate ? p.poDate.toISOString().slice(0, 10) : ""]));
tableSheet("Turnover",
  ["Financial Year", "Amount"],
  v.turnovers.map((t) => [t.financialYear, t.amount]));
```
Add `Category` and `OEM/Dealer` `kv()` rows to the Overview "Company Information" section. The Documents sheet/section stays as-is.

- [ ] **Step 3: Type-check + runtime smoke**

Run: `npm run build && npm run lint`
Then download `/api/vendors/<id>/export` for the Task-4 vendor and open the `.xlsx`; confirm 6 sheets with the expected rows.

- [ ] **Step 4: Commit**

```bash
git add src/lib/vendor-excel.ts src/app/api/vendors/[id]/export/route.ts
git commit -m "feat(export): multi-sheet vendor workbook (services/products/experience/POs/turnover)"
```

---

## Self-Review

**Spec coverage:**
- Category multi-select → Task 1 (cols), Task 2 (refine), Task 4 (UI), Task 5/6 (display/export) ✅
- Service Activities (EPC/BOS/I&C/Other + details) → reuse `VendorService`, Task 3/4 ✅
- Product OEM/Dealer + rows → `oemOrDealer` + `VendorProduct`, Tasks 1–6 ✅
- Experience / POs / Turnover structured → new tables, Tasks 1–6 ✅
- PO file uploads → `PURCHASE_ORDER` docType, Task 3/4 ✅
- PAN required, GST optional → Task 2/4/5 ✅
- Legacy tax fields removed from form → Task 4 (wizard) + Task 5 (admin edit) ✅
- Multi-sheet export + sectioned admin → Task 5 + Task 6 ✅
- Additive migration → Task 1 ✅

**Placeholder scan:** No TBD/TODO; UI row tasks reference the exact existing pattern (lines 858–910 / 917–927) and give complete field lists — acceptable since the pattern is in the same file the engineer is editing.

**Type consistency:** Row field names are identical across schema (Task 1), zod (Task 2), persistence (Task 3), form encoding (Task 4), and export (Task 6): product `{name,brand,model}`, experience `{financialYear,clientProject,scope,value}`, PO `{poNumber,client,value,poDate}`, turnover `{financialYear,amount}`. `oemOrDealer` values `"OEM"|"DEALER"` consistent. `registrationSchema` refactor to `baseRegistration` keeps `vendorEditSchema.omit()` valid (Task 2 Step 4).

**Known adaptation:** No test runner → verification is `npm run build` + `npm run lint` + the named runtime smoke check per task, per CLAUDE.md.
