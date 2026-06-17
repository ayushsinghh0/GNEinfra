# Vendor field editing + document re-upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let GNE admins correct a submitted vendor's fields inline, and let admins email a vendor a secure single-use link to re-upload one corrupt/wrong document (replacing the old file).

**Architecture:** Two independent features on the existing Next.js 16 + Prisma + Postgres app. (1) An inline edit mode on the vendor detail page backed by a new `PATCH /api/vendors/[id]` that reuses the registration validation schema. (2) A new `DocumentRequest` token model; admins create a request (emailing the vendor a `/reupload/<token>` link), the vendor uploads one replacement file through a public API that saves the new file and deletes the old one.

**Tech Stack:** Next.js 16 (App Router, async route params), React 19 client components, Prisma 6 / Postgres, Zod 3, nodemailer (Mailpit in dev), existing storage driver (`@/lib/storage`).

## Global Constraints

- **NOT standard Next.js** — before writing any route/page code, read the relevant guide under `node_modules/next/dist/docs/`. APIs/conventions may differ from training data. Route params are `Promise`-wrapped and must be `await`ed (see existing routes).
- **No test runner exists.** Verification gate for every task = `npx tsc --noEmit` (typecheck) + `npm run lint` (must pass clean), plus the manual check named in the task. Do not add a test framework.
- **Admin-only APIs** must call `await isAdminAuthed()` first and return `401 { error: "Unauthorized" }` when false — exactly like `src/app/api/vendors/[id]/status/route.ts`.
- **Public token APIs/pages** (re-upload) take NO auth — security is the unguessable, single-use, time-limited token, mirroring the invite flow.
- **Validation parity:** reuse the client-safe primitives in `src/lib/vendor-validation.ts` on the client and the Zod schema in `src/lib/validation.ts` on the server. Never hand-roll new rules.
- **Re-upload link expiry:** 30 days. **Old file on re-upload:** replaced (delete old storage object + DB row).
- **Document type/size limits** are owned by `src/lib/documents.ts` (`saveDocument`): 10 MB, PDF/PNG/JPEG/JPG/WEBP. Do not duplicate the constants server-side; mirror them only for client-side pre-checks (as `RegistrationForm.tsx` already does).
- Commit after every task with a `feat:`/`refactor:` message. Branch is `main`; create commits directly (no PR unless asked).

---

### Task 1: `DocumentRequest` Prisma model + migration

**Files:**
- Modify: `prisma/schema.prisma` (add enum + model near the `VendorInvite` model ~line 161; add a relation field to `Vendor` ~line 80-85)

**Interfaces:**
- Produces: Prisma model `DocumentRequest { id, token (unique), vendorId, documentId?, docType, status: DocumentRequestStatus, expiresAt?, createdAt, fulfilledAt? }`; enum `DocumentRequestStatus { PENDING USED EXPIRED REVOKED }`; `Vendor.documentRequests DocumentRequest[]`.

- [ ] **Step 1: Add the enum and model to `prisma/schema.prisma`**

Add this block immediately after the `VendorInvite` model (after its closing `}` around line 161):

```prisma
// A request asking a vendor to re-upload one specific document (e.g. the original
// was corrupt). Carries an unguessable single-use token; the vendor opens
// /reupload/<token> to upload the replacement. Mirrors VendorInvite's security model.
enum DocumentRequestStatus {
  PENDING
  USED
  EXPIRED
  REVOKED
}

model DocumentRequest {
  id       String @id @default(cuid())
  token    String @unique

  vendorId String
  vendor   Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  // The corrupt document being replaced. Nullable: the file may already be purged
  // by the time the vendor responds, but the request still names a docType.
  documentId String?
  docType    String // e.g. GST_CERTIFICATE — what the vendor must re-upload

  status      DocumentRequestStatus @default(PENDING)
  expiresAt   DateTime?
  createdAt   DateTime              @default(now())
  fulfilledAt DateTime?

  @@index([vendorId])
  @@index([status])
}
```

- [ ] **Step 2: Add the inverse relation to `Vendor`**

In the `Vendor` model's `// ── Relations ──` block (around lines 81-85), add one line after `invite         VendorInvite?`:

```prisma
  documentRequests DocumentRequest[]
```

- [ ] **Step 3: Create and apply the migration**

Run: `npm run db:migrate -- --name add_document_requests`
Expected: Prisma creates `prisma/migrations/<timestamp>_add_document_requests/` and prints "Your database is now in sync with your schema." The Prisma Client is regenerated automatically by `migrate dev`.

(If the dev database is not running, start it first — the project uses Postgres via `DATABASE_URL`. Do NOT hand-edit migration SQL.)

- [ ] **Step 4: Typecheck — confirm the new model is on the client**

Run: `npx tsc --noEmit`
Expected: PASS (exit 0). This confirms `prisma.documentRequest` and `DocumentRequestStatus` are now typed.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add DocumentRequest model for document re-upload requests"
```

---

### Task 2: `vendorEditSchema` validation

**Files:**
- Modify: `src/lib/validation.ts` (add after `registrationSchema` / `RegistrationInput`, around line 90)

**Interfaces:**
- Consumes: existing `registrationSchema` (Task uses its `.omit`).
- Produces: `vendorEditSchema` (Zod object — every vendor scalar field with the same rules as registration, no `projects`) and `type VendorEditInput`.

- [ ] **Step 1: Add the schema**

In `src/lib/validation.ts`, immediately after the line `export type RegistrationInput = z.infer<typeof registrationSchema>;` (line 90), add:

```ts
// Admin correcting a submitted vendor's own fields. Identical rules to
// registration (GST/PAN upper-cased, mobile normalised, IFSC checked) so the
// edit form and the wizard can never validate differently — minus `projects`,
// which the admin edit screen does not touch.
export const vendorEditSchema = registrationSchema.omit({ projects: true });
export type VendorEditInput = z.infer<typeof vendorEditSchema>;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. (`.omit` is valid on a Zod object; `VendorEditInput` has all vendor scalar fields and no `projects`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/validation.ts
git commit -m "feat: add vendorEditSchema for admin vendor edits"
```

---

### Task 3: `PATCH /api/vendors/[id]` — save vendor edits

**Files:**
- Create: `src/app/api/vendors/[id]/route.ts`
- Reference: `src/app/api/vendors/[id]/status/route.ts` (auth + params + error style), `src/app/api/register/route.ts:144-209` (field mapping + `dateOfIncorporation` handling)

**Interfaces:**
- Consumes: `vendorEditSchema`, `VendorEditInput` (Task 2); `isAdminAuthed`; `prisma`.
- Produces: `PATCH` handler returning `{ ok: true, vendor }` on success. Client (Task 4) calls `fetch(\`/api/vendors/${id}\`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify(fields) })`.

- [ ] **Step 1: Create the route file**

Create `src/app/api/vendors/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { vendorEditSchema } from "@/lib/validation";

// PATCH /api/vendors/<id>  (admin only)
// Corrects a vendor's own detail fields (company / statutory / bank). Validation
// is identical to registration via vendorEditSchema; `updatedAt` bumps itself.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = vendorEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const d = parsed.data;

  // dateOfIncorporation arrives as an ISO date string (or undefined). Mirror the
  // register route: store a valid Date, otherwise null.
  const doi = d.dateOfIncorporation ? new Date(d.dateOfIncorporation) : null;

  try {
    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        companyName: d.companyName,
        contactPerson: d.contactPerson,
        mobileNumber: d.mobileNumber,
        email: d.email,
        address: d.address ?? null,
        state: d.state ?? null,
        website: d.website ?? null,
        dateOfIncorporation: doi && !isNaN(doi.getTime()) ? doi : null,
        yearsOfService: d.yearsOfService ?? null,
        annualTurnover: d.annualTurnover ?? null,
        gstNo: d.gstNo,
        panNo: d.panNo,
        exciseNo: d.exciseNo ?? null,
        tinNo: d.tinNo ?? null,
        vatLstNo: d.vatLstNo ?? null,
        cstNo: d.cstNo ?? null,
        serviceTaxNo: d.serviceTaxNo ?? null,
        msmeNo: d.msmeNo ?? null,
        bankName: d.bankName ?? null,
        bankBranchAddress: d.bankBranchAddress ?? null,
        bankAccountNo: d.bankAccountNo ?? null,
        bankBranchCode: d.bankBranchCode ?? null,
        ifscCode: d.ifscCode ?? null,
        swiftCode: d.swiftCode ?? null,
        ibanCode: d.ibanCode ?? null,
      },
    });
    return NextResponse.json({ ok: true, vendor });
  } catch (e) {
    // P2025 = record to update not found.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Could not save the changes. Please try again." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS. (Note: `optionalStr` fields are typed `string | undefined`; mapping `?? null` is correct since the columns are nullable.)

- [ ] **Step 3: Manual smoke test**

Start the app (`npm run dev`), log in as admin, then in a terminal confirm the unauth guard:
Run: `curl -i -X PATCH http://localhost:3000/api/vendors/anything -H "Content-Type: application/json" -d '{}'`
Expected: `HTTP/1.1 401` with `{"error":"Unauthorized"}` (no admin cookie present).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/vendors/[id]/route.ts
git commit -m "feat: PATCH /api/vendors/[id] to save admin vendor edits"
```

---

### Task 4: `VendorInfoCards` — inline editable detail cards

**Files:**
- Create: `src/components/VendorInfoCards.tsx`
- Modify: `src/app/admin/vendors/[id]/page.tsx` (replace the three static cards — Company Information lines ~177-199, Statutory & Tax ~201-222, Bank Details ~224-244 — with `<VendorInfoCards ... />`; remove the now-unused `Building`, `ShieldCheck`, `Banknote` icon imports IF no longer referenced, and the `Row` helper if it becomes unused)

**Interfaces:**
- Consumes: `PATCH /api/vendors/[id]` (Task 3); `vendor-validation.ts` primitives; `@/components/ui` (`Card`, `CardHeader`, `CardBody`, `Field`, `Input`, `Button`, `btn`).
- Produces: default-exported client component `VendorInfoCards({ vendorId, initial })` where `initial` is a flat object of the 25 vendor scalar fields as strings (dates pre-formatted `YYYY-MM-DD`). Renders three `<Card>`s as a fragment (so they sit in the page's existing grid).

- [ ] **Step 1: Create the component**

Create `src/components/VendorInfoCards.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardBody,
  Field,
  Input,
  Button,
  btn,
} from "@/components/ui";
import {
  Building,
  ShieldCheck,
  Banknote,
  Pencil,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import {
  validateCompanyName,
  validateEmail,
  validateMobile,
  validateGst,
  validatePan,
  validateIfsc,
  validateRequired,
  type FieldError,
} from "@/lib/vendor-validation";

// The 25 editable vendor scalar fields, as strings (empty string = blank).
export type VendorFields = {
  companyName: string;
  contactPerson: string;
  mobileNumber: string;
  email: string;
  address: string;
  state: string;
  website: string;
  dateOfIncorporation: string; // YYYY-MM-DD or ""
  yearsOfService: string;
  annualTurnover: string;
  gstNo: string;
  panNo: string;
  exciseNo: string;
  tinNo: string;
  vatLstNo: string;
  cstNo: string;
  serviceTaxNo: string;
  msmeNo: string;
  bankName: string;
  bankBranchAddress: string;
  bankAccountNo: string;
  bankBranchCode: string;
  ifscCode: string;
  swiftCode: string;
  ibanCode: string;
};

type FieldKey = keyof VendorFields;

const LABELS: Record<FieldKey, string> = {
  companyName: "Company Name",
  contactPerson: "Contact Person",
  mobileNumber: "Mobile",
  email: "Email",
  address: "Address",
  state: "State",
  website: "Website",
  dateOfIncorporation: "Date of Incorporation",
  yearsOfService: "Years of Service",
  annualTurnover: "Annual Turnover",
  gstNo: "GST No",
  panNo: "PAN No",
  exciseNo: "Excise No",
  tinNo: "TIN No",
  vatLstNo: "VAT / LST No",
  cstNo: "CST No",
  serviceTaxNo: "Service Tax No",
  msmeNo: "MSME No",
  bankName: "Bank Name",
  bankBranchAddress: "Branch Address",
  bankAccountNo: "Account No",
  bankBranchCode: "Branch Code",
  ifscCode: "IFSC Code",
  swiftCode: "SWIFT Code",
  ibanCode: "IBAN Code",
};

const VALIDATORS: Partial<Record<FieldKey, (v: string) => FieldError>> = {
  companyName: validateCompanyName,
  contactPerson: (v) => validateRequired(v, "Contact person"),
  mobileNumber: validateMobile,
  email: validateEmail,
  gstNo: validateGst,
  panNo: validatePan,
  ifscCode: validateIfsc,
};

const REQUIRED = new Set<FieldKey>([
  "companyName",
  "contactPerson",
  "mobileNumber",
  "email",
  "gstNo",
  "panNo",
]);

const COMPANY: FieldKey[] = [
  "companyName",
  "contactPerson",
  "mobileNumber",
  "email",
  "address",
  "state",
  "website",
  "dateOfIncorporation",
  "yearsOfService",
  "annualTurnover",
];
const STATUTORY: FieldKey[] = [
  "gstNo",
  "panNo",
  "exciseNo",
  "tinNo",
  "vatLstNo",
  "cstNo",
  "serviceTaxNo",
  "msmeNo",
];
const BANK: FieldKey[] = [
  "bankName",
  "bankBranchAddress",
  "bankAccountNo",
  "bankBranchCode",
  "ifscCode",
  "swiftCode",
  "ibanCode",
];

function ViewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 py-2 border-b border-slate-100 last:border-0">
      <dt className="w-44 shrink-0 text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">
        {value || <span className="font-normal text-slate-300">—</span>}
      </dd>
    </div>
  );
}

export default function VendorInfoCards({
  vendorId,
  initial,
}: {
  vendorId: string;
  initial: VendorFields;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<VendorFields>(initial);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(name: FieldKey, value: string) {
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) {
      const msg = VALIDATORS[name]?.(value) ?? null;
      setErrors((e) => {
        const next = { ...e };
        if (msg) next[name] = msg;
        else delete next[name];
        return next;
      });
    }
  }

  function validateAll(): boolean {
    const found: Partial<Record<FieldKey, string>> = {};
    (Object.keys(VALIDATORS) as FieldKey[]).forEach((k) => {
      const msg = VALIDATORS[k]?.(form[k]);
      if (msg) found[k] = msg;
    });
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  function startEdit() {
    setForm(initial);
    setErrors({});
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setErrors({});
    setError(null);
  }

  async function save() {
    if (!validateAll()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/vendors/${vendorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save the changes.");
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function renderField(name: FieldKey) {
    const hasErr = Boolean(errors[name]);
    return (
      <Field
        key={name}
        label={LABELS[name]}
        required={REQUIRED.has(name)}
        error={hasErr ? errors[name] : undefined}
      >
        <Input
          type={name === "dateOfIncorporation" ? "date" : "text"}
          value={form[name]}
          onChange={(e) => setField(name, e.target.value)}
          aria-invalid={hasErr || undefined}
          className={
            hasErr
              ? "border-rose-400 focus:border-rose-400 focus:ring-rose-100/70"
              : undefined
          }
        />
      </Field>
    );
  }

  const editControls = editing ? (
    <div className="flex items-center gap-2">
      <Button type="button" variant="primary" size="sm" disabled={saving} onClick={save}>
        <Check className="h-4 w-4" />
        {saving ? "Saving…" : "Save"}
      </Button>
      <button
        type="button"
        disabled={saving}
        onClick={cancel}
        className={btn("secondary", "sm")}
      >
        <X className="h-4 w-4" />
        Cancel
      </button>
    </div>
  ) : (
    <button type="button" onClick={startEdit} className={btn("secondary", "sm")}>
      <Pencil className="h-4 w-4" />
      Edit
    </button>
  );

  function body(keys: FieldKey[]) {
    if (!editing) {
      return (
        <dl>
          {keys.map((k) => (
            <ViewRow key={k} label={LABELS[k]} value={form[k]} />
          ))}
        </dl>
      );
    }
    return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{keys.map(renderField)}</div>;
  }

  return (
    <>
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Building className="h-[18px] w-[18px] text-brand" />
              Company Information
            </span>
          }
          action={editControls}
        />
        <CardBody>
          {body(COMPANY)}
          {editing && error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-[18px] w-[18px] text-brand" />
              Statutory &amp; Tax
            </span>
          }
        />
        <CardBody>{body(STATUTORY)}</CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Banknote className="h-[18px] w-[18px] text-brand" />
              Bank Details
            </span>
          }
        />
        <CardBody>{body(BANK)}</CardBody>
      </Card>
    </>
  );
}
```

- [ ] **Step 2: Wire it into the detail page**

In `src/app/admin/vendors/[id]/page.tsx`:

1. Add the import near the other component imports (after the `VendorStatusActions` import line 7):

```tsx
import VendorInfoCards, { type VendorFields } from "@/components/VendorInfoCards";
```

2. Just before the `return (` (after the `emailMismatch` const, ~line 92), build the string-typed field object:

```tsx
  const vendorFields: VendorFields = {
    companyName: v.companyName ?? "",
    contactPerson: v.contactPerson ?? "",
    mobileNumber: v.mobileNumber ?? "",
    email: v.email ?? "",
    address: v.address ?? "",
    state: v.state ?? "",
    website: v.website ?? "",
    dateOfIncorporation: v.dateOfIncorporation
      ? v.dateOfIncorporation.toISOString().slice(0, 10)
      : "",
    yearsOfService: v.yearsOfService ?? "",
    annualTurnover: v.annualTurnover ?? "",
    gstNo: v.gstNo ?? "",
    panNo: v.panNo ?? "",
    exciseNo: v.exciseNo ?? "",
    tinNo: v.tinNo ?? "",
    vatLstNo: v.vatLstNo ?? "",
    cstNo: v.cstNo ?? "",
    serviceTaxNo: v.serviceTaxNo ?? "",
    msmeNo: v.msmeNo ?? "",
    bankName: v.bankName ?? "",
    bankBranchAddress: v.bankBranchAddress ?? "",
    bankAccountNo: v.bankAccountNo ?? "",
    bankBranchCode: v.bankBranchCode ?? "",
    ifscCode: v.ifscCode ?? "",
    swiftCode: v.swiftCode ?? "",
    ibanCode: v.ibanCode ?? "",
  };
```

3. In the JSX, replace the three `<Card>` blocks (Company Information, Statutory & Tax, Bank Details — the first three children of `<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">`) with a single line, keeping the Documents `<Card>` as the fourth grid child:

```tsx
          <VendorInfoCards vendorId={v.id} initial={vendorFields} />
```

4. Remove the now-unused `Row` function (lines 33-42) and any of the `Building`, `ShieldCheck`, `Banknote` imports that are no longer referenced elsewhere in the file.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS. If lint flags an unused import (`Row`, `Building`, etc.), delete that symbol and re-run until clean.

- [ ] **Step 4: Manual test**

`npm run dev`, open a vendor at `/admin/vendors/<id>`. Click **Edit** on Company Information → all three cards become inputs. Change the Mobile to `123` → Save → inline error "Enter a valid 10-digit Indian mobile number", no save. Fix it, change the bank account number, Save → cards return to view mode showing the new value (page refreshed). Reload the page → value persisted.

- [ ] **Step 5: Commit**

```bash
git add src/components/VendorInfoCards.tsx "src/app/admin/vendors/[id]/page.tsx"
git commit -m "feat: inline-editable vendor detail cards"
```

---

### Task 5: Shared doc labels, re-upload token, re-upload email template

**Files:**
- Create: `src/lib/doc-labels.ts`
- Modify: `src/lib/tokens.ts` (add a second generator)
- Modify: `src/lib/mailer.ts` (add `documentReuploadEmail`)
- Modify: `src/app/admin/vendors/[id]/page.tsx` (replace its local `DOC_LABELS` const with an import from the new module)

**Interfaces:**
- Produces: `DOC_LABELS: Record<string,string>` and `docLabel(type: string): string` from `@/lib/doc-labels`; `newDocumentRequestToken(): string` from `@/lib/tokens`; `documentReuploadEmail(link: string, company: string, docLabel: string): { subject, html, text }` from `@/lib/mailer`.

- [ ] **Step 1: Create the shared label module**

Create `src/lib/doc-labels.ts`:

```ts
// Human labels for vendor document types. Client-safe (no server imports) so it
// can be used in both server components and client upload UIs.
export const DOC_LABELS: Record<string, string> = {
  CANCELLED_CHEQUE: "Cancelled Cheque",
  GST_CERTIFICATE: "GST Certificate",
  PAN_CARD: "PAN Card",
  OTHER: "Other",
};

export function docLabel(type: string): string {
  return DOC_LABELS[type] ?? type;
}
```

- [ ] **Step 2: Use it in the detail page**

In `src/app/admin/vendors/[id]/page.tsx`, delete the local `DOC_LABELS` const (lines ~65-70) and add an import near the top:

```tsx
import { DOC_LABELS } from "@/lib/doc-labels";
```

(The existing `DOC_LABELS[d.docType] ?? d.docType` usage keeps working unchanged.)

- [ ] **Step 3: Add the token generator**

In `src/lib/tokens.ts`, add below `newInviteToken`:

```ts
// URL-safe random token for single-use document re-upload links.
export function newDocumentRequestToken() {
  return randomBytes(24).toString("base64url");
}
```

- [ ] **Step 4: Add the email template**

In `src/lib/mailer.ts`, add after `inviteEmail` (after its closing `}` ~line 78):

```ts
export function documentReuploadEmail(link: string, company: string, docLabel: string) {
  return {
    subject: `Action needed: re-upload your ${docLabel}`,
    html: wrap(
      "Document Re-upload Request",
      `<p>Dear ${esc(company)} team,</p>
       <p>We were unable to use the <b>${esc(docLabel)}</b> on file for your GNE vendor
       registration (it may be unreadable or incomplete). Please upload a fresh copy
       using the secure link below:</p>
       <p style="text-align:center;margin:28px 0">
         <a href="${link}" style="background:${BRAND};color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold">Upload ${esc(docLabel)}</a>
       </p>
       <p style="font-size:13px;color:#475569">Or paste this link into your browser:<br><span style="word-break:break-all">${link}</span></p>
       <p style="font-size:13px;color:#94a3b8">This link is valid for 30 days and can be used once.</p>`
    ),
    text: `Dear ${company} team, please re-upload your ${docLabel} for your GNE vendor registration: ${link} (valid 30 days, single use).`,
  };
}
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS. (`BRAND`, `esc`, `wrap` are already in scope in `mailer.ts`; `randomBytes` already imported in `tokens.ts`.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/doc-labels.ts src/lib/tokens.ts src/lib/mailer.ts "src/app/admin/vendors/[id]/page.tsx"
git commit -m "feat: shared doc labels, re-upload token + email template"
```

---

### Task 6: `POST /api/vendors/[id]/document-requests` — create + email a request

**Files:**
- Create: `src/app/api/vendors/[id]/document-requests/route.ts`
- Reference: `src/app/api/invites/route.ts` (token + email + SMTP-failure fallback pattern)

**Interfaces:**
- Consumes: `newDocumentRequestToken`, `documentReuploadEmail`, `sendMail`, `docLabel`, `isAdminAuthed`, `prisma`.
- Produces: `POST` handler. Body: `{ documentId: string }`. Success: `{ ok: true, emailed: true }`; on SMTP failure: `{ ok: true, emailed: false, link, warning }`. Client (Task 7) reads `emailed`/`link`/`warning`.

- [ ] **Step 1: Create the route**

Create `src/app/api/vendors/[id]/document-requests/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { newDocumentRequestToken } from "@/lib/tokens";
import { sendMail, documentReuploadEmail } from "@/lib/mailer";
import { docLabel } from "@/lib/doc-labels";

// POST /api/vendors/<id>/document-requests   (admin only)
// Body: { documentId }. Emails the vendor a single-use link to re-upload that
// specific document. Revokes any earlier pending request for the same document
// so only one live link exists.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: vendorId } = await params;
  const body = await req.json().catch(() => null);
  const documentId = body && typeof body.documentId === "string" ? body.documentId : "";
  if (!documentId) {
    return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
  }

  // The document must exist AND belong to this vendor.
  const doc = await prisma.vendorDocument.findUnique({ where: { id: documentId } });
  if (!doc || doc.vendorId !== vendorId) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { email: true, companyName: true },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const token = newDocumentRequestToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

  try {
    // Only one live link per document.
    await prisma.documentRequest.updateMany({
      where: { documentId, status: "PENDING" },
      data: { status: "REVOKED" },
    });
    await prisma.documentRequest.create({
      data: { token, vendorId, documentId, docType: doc.docType, expiresAt },
    });
  } catch {
    return NextResponse.json({ error: "Could not create the request." }, { status: 500 });
  }

  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  const link = `${base}/reupload/${token}`;
  const tpl = documentReuploadEmail(link, vendor.companyName, docLabel(doc.docType));

  try {
    await sendMail({ to: vendor.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
  } catch (err) {
    // Mirror the invites route: the request is saved; let the admin share the link.
    console.error("[document-requests] email send failed", err);
    return NextResponse.json({
      ok: true,
      emailed: false,
      link,
      warning: "Request created but the email could not be sent. Share the link manually.",
    });
  }

  return NextResponse.json({ ok: true, emailed: true });
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 3: Manual smoke test (unauth guard)**

Run: `curl -i -X POST http://localhost:3000/api/vendors/x/document-requests -H "Content-Type: application/json" -d '{"documentId":"y"}'`
Expected: `HTTP/1.1 401`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/vendors/[id]/document-requests/route.ts"
git commit -m "feat: POST document-requests to email a vendor a re-upload link"
```

---

### Task 7: `DocumentRequestButton` — "Request new file" per document

**Files:**
- Create: `src/components/DocumentRequestButton.tsx`
- Modify: `src/app/admin/vendors/[id]/page.tsx` (add the button to each non-purged document card, in the action row next to View/Download ~lines 279-296)

**Interfaces:**
- Consumes: `POST /api/vendors/[id]/document-requests` (Task 6); `@/components/ui` (`btn`).
- Produces: default-exported client component `DocumentRequestButton({ vendorId, documentId })`.

- [ ] **Step 1: Create the component**

Create `src/components/DocumentRequestButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { btn } from "@/components/ui";
import { MailWarning, Check } from "lucide-react";

type State = "idle" | "sending" | "sent" | "manual" | "error";

export default function DocumentRequestButton({
  vendorId,
  documentId,
}: {
  vendorId: string;
  documentId: string;
}) {
  const [state, setState] = useState<State>("idle");
  const [detail, setDetail] = useState<string | null>(null);

  async function request() {
    setState("sending");
    setDetail(null);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/document-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send the request.");
      if (data.emailed === false) {
        setState("manual");
        setDetail(typeof data.link === "string" ? data.link : null);
      } else {
        setState("sent");
      }
    } catch (e) {
      setState("error");
      setDetail(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  if (state === "sent") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
        <Check className="h-4 w-4" />
        Re-upload email sent
      </span>
    );
  }

  if (state === "manual") {
    return (
      <span className="text-xs text-amber-700">
        Email failed — share this link:{" "}
        <span className="break-all font-medium">{detail}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={request}
        disabled={state === "sending"}
        className={btn("secondary", "sm")}
      >
        <MailWarning className="h-4 w-4" />
        {state === "sending" ? "Sending…" : "Request new file"}
      </button>
      {state === "error" && detail && (
        <span className="text-xs text-rose-600">{detail}</span>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Wire it into each document card**

In `src/app/admin/vendors/[id]/page.tsx`:

1. Add the import near the top component imports:

```tsx
import DocumentRequestButton from "@/components/DocumentRequestButton";
```

2. Inside the non-purged document actions `<div className="flex shrink-0 items-center gap-2">` (the block containing the View and Download anchors, ~lines 279-296), add as the first child:

```tsx
                            <DocumentRequestButton vendorId={v.id} documentId={d.id} />
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Manual test against Mailpit**

Ensure Mailpit is running (dev SMTP at localhost:1025, UI at http://localhost:8025). On a vendor detail page with at least one document, click **Request new file** → button shows "Re-upload email sent". Open Mailpit → an email "Action needed: re-upload your <Label>" with an `/reupload/<token>` link is present.

- [ ] **Step 5: Commit**

```bash
git add src/components/DocumentRequestButton.tsx "src/app/admin/vendors/[id]/page.tsx"
git commit -m "feat: 'Request new file' button on vendor document cards"
```

---

### Task 8: `/reupload/[token]` public page + upload form

**Files:**
- Create: `src/app/reupload/[token]/page.tsx`
- Create: `src/components/ReuploadForm.tsx`
- Reference: `src/app/register/[token]/page.tsx` (token-state Notice pattern), `src/components/RegistrationForm.tsx:255-267` (client-side file validation)

**Interfaces:**
- Consumes: `prisma`, `docLabel`; `POST /api/reupload` (Task 9, built next — the form posts `token` + `file` as multipart).
- Produces: server page rendering a `Notice` for bad token states or `<ReuploadForm token docLabel />` for a valid pending request.

- [ ] **Step 1: Create the page**

Create `src/app/reupload/[token]/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { docLabel } from "@/lib/doc-labels";
import ReuploadForm from "@/components/ReuploadForm";
import { AlertCircle, CheckCircle2 } from "lucide-react";

// Must render dynamically so a consumed/expired token is never served from cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;

function Notice({
  title,
  body,
  tone = "amber",
}: {
  title: string;
  body: string;
  tone?: "amber" | "emerald";
}) {
  const tones = {
    amber: { ring: "bg-amber-50 text-amber-600", icon: <AlertCircle className="h-6 w-6" /> },
    emerald: { ring: "bg-emerald-50 text-emerald-600", icon: <CheckCircle2 className="h-6 w-6" /> },
  }[tone];
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-10 text-center">
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand text-white text-sm font-bold tracking-tight shadow-sm">
          GNE
        </div>
        <div className={`mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl ${tones.ring}`}>
          {tones.icon}
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{body}</p>
        <p className="mt-6 text-xs text-slate-400">
          Please contact GNE procurement if you need a new link.
        </p>
      </div>
    </main>
  );
}

export default async function ReuploadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const reqRow = await prisma.documentRequest.findUnique({ where: { token } });

  if (!reqRow) {
    return <Notice title="Invalid link" body="This upload link is not valid." />;
  }
  if (reqRow.status === "USED") {
    return (
      <Notice
        tone="emerald"
        title="Already uploaded"
        body="This document has already been re-uploaded. Thank you — our procurement team has it."
      />
    );
  }
  if (reqRow.status === "REVOKED") {
    return <Notice title="Link no longer valid" body="A newer request has replaced this link." />;
  }
  if (reqRow.expiresAt && reqRow.expiresAt < new Date()) {
    return <Notice title="Link expired" body="This upload link has expired." />;
  }

  return <ReuploadForm token={token} docLabel={docLabel(reqRow.docType)} />;
}
```

- [ ] **Step 2: Create the upload form**

Create `src/components/ReuploadForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";

// Mirror the server's accepted types + size cap (src/lib/documents.ts) so an
// unsupported/oversize file is rejected before the single-use token is spent.
const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

function validateFile(file: File): string | null {
  if (file.size > MAX_BYTES) return `"${file.name}" is larger than 10 MB`;
  if (!file.type || !ALLOWED.includes(file.type.toLowerCase()))
    return `"${file.name}" must be a PDF, JPG, PNG or WEBP file`;
  return null;
}

export default function ReuploadForm({
  token,
  docLabel,
}: {
  token: string;
  docLabel: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function onSelect(f: File | null) {
    setFile(f);
    setError(f ? validateFile(f) : null);
  }

  async function submit() {
    if (!file) {
      setError("Please choose a file to upload.");
      return;
    }
    const v = validateFile(file);
    if (v) {
      setError(v);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("token", token);
      fd.set("file", file);
      const res = await fetch("/api/reupload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed. Please try again.");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200/80 p-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Upload received</h1>
          <p className="mt-2 text-sm text-slate-600">
            Thank you. Your {docLabel} has been received by GNE procurement. This link is now closed.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200/80 p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand text-white text-sm font-bold tracking-tight shadow-sm">
          GNE
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Re-upload your {docLabel}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Please choose a clear copy (PDF or image, max 10 MB). This link can be used once.
        </p>

        <label
          className={`mt-5 block cursor-pointer rounded-lg border border-dashed px-4 py-3 transition-colors ${
            error
              ? "border-rose-300 bg-rose-50/40"
              : "border-slate-300 bg-slate-50/50 hover:border-brand hover:bg-brand-50/40"
          }`}
        >
          <span className="flex items-center gap-2 text-xs text-slate-500">
            <UploadCloud className="h-4 w-4" />
            {file ? file.name : "Choose a PDF or image"}
          </span>
          <input
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
          />
        </label>

        {error && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={submit} disabled={submitting || !file} className="px-6">
            {submitting ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS. Resolve any unused-import warning as noted above.

- [ ] **Step 4: Manual test (states)**

With a pending token from Task 7's Mailpit email, open `/reupload/<token>` → see "Re-upload your <Label>" form. Open `/reupload/garbage` → "Invalid link". (Used/expired states are exercised end-to-end in Task 9 / Task 10.)

- [ ] **Step 5: Commit**

```bash
git add "src/app/reupload/[token]/page.tsx" src/components/ReuploadForm.tsx
git commit -m "feat: public /reupload/[token] page and upload form"
```

---

### Task 9: `POST /api/reupload` — accept the replacement file

**Files:**
- Create: `src/app/api/reupload/route.ts`
- Reference: `src/app/api/register/route.ts` (formData + saveDocument + VendorDocument.create), `src/lib/documents.ts` (`saveDocument`, `deleteDocument`)

**Interfaces:**
- Consumes: `prisma`, `saveDocument`, `deleteDocument`. Reads multipart `token` (string) + `file` (File).
- Produces: `POST` handler returning `{ ok: true }` on success; `404`/`403`/`409`/`410`/`400`/`413`/`500` otherwise.

- [ ] **Step 1: Create the route**

Create `src/app/api/reupload/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveDocument, deleteDocument } from "@/lib/documents";

// Reject obviously huge bodies up front (saveDocument also enforces 10 MB/file).
const MAX_REQUEST_BYTES = 15 * 1024 * 1024;

// POST /api/reupload   (public; protected by the single-use token)
// multipart/form-data: token + a single `file`. Saves the new file, deletes the
// old corrupt one, and marks the request USED.
export async function POST(req: NextRequest) {
  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Upload too large." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected form data" }, { status: 400 });
  }

  const token = String(form.get("token") || "");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const reqRow = await prisma.documentRequest.findUnique({ where: { token } });
  if (!reqRow) {
    return NextResponse.json({ error: "Invalid upload link" }, { status: 404 });
  }
  if (reqRow.status === "USED") {
    return NextResponse.json({ error: "This link has already been used." }, { status: 409 });
  }
  if (reqRow.status === "REVOKED") {
    return NextResponse.json({ error: "This link is no longer valid." }, { status: 403 });
  }
  if (reqRow.expiresAt && reqRow.expiresAt < new Date()) {
    return NextResponse.json({ error: "This link has expired." }, { status: 410 });
  }

  // Claim the request first (race-safe single-use): only the request that flips
  // PENDING->USED proceeds; a concurrent double-submit matches 0 rows and stops
  // before storing a duplicate file.
  const claimed = await prisma.documentRequest.updateMany({
    where: { id: reqRow.id, status: "PENDING" },
    data: { status: "USED", fulfilledAt: new Date() },
  });
  if (claimed.count === 0) {
    return NextResponse.json({ error: "This link has already been used." }, { status: 409 });
  }

  // Store the new file (enforces type + 10 MB). On failure, release the claim so
  // the vendor can retry with the same link.
  let saved;
  try {
    saved = await saveDocument(reqRow.vendorId, file);
  } catch (e) {
    await prisma.documentRequest.updateMany({
      where: { id: reqRow.id, status: "USED" },
      data: { status: "PENDING", fulfilledAt: null },
    });
    const msg = e instanceof Error ? e.message : "Could not store the file.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    await prisma.vendorDocument.create({
      data: {
        vendorId: reqRow.vendorId,
        docType: reqRow.docType,
        originalName: saved.originalName,
        storageKey: saved.storageKey,
        mimeType: saved.mimeType,
        originalSize: saved.originalSize,
        storedSize: saved.storedSize,
        compressed: saved.compressed,
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not save the document." }, { status: 500 });
  }

  // Replace: delete the old corrupt document (storage object + row). Best-effort —
  // the file may already be purged; never fail the upload over the cleanup.
  if (reqRow.documentId) {
    try {
      const old = await prisma.vendorDocument.findUnique({ where: { id: reqRow.documentId } });
      if (old) {
        try {
          await deleteDocument(old.storageKey);
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code !== "ENOENT" && code !== "NoSuchKey") {
            console.error("[reupload] old file delete failed", old.storageKey, err);
          }
        }
        await prisma.vendorDocument.delete({ where: { id: old.id } });
      }
    } catch (err) {
      console.error("[reupload] old document cleanup failed", reqRow.documentId, err);
    }
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 3: Manual test (missing token)**

Run: `curl -i -X POST http://localhost:3000/api/reupload -F "file=@/dev/null"`
Expected: `HTTP/1.1 400` `{"error":"Missing token"}` (no token field). On Windows without `/dev/null`, POST with no body: `curl -i -X POST http://localhost:3000/api/reupload` → `400 Expected form data` or `400 Missing token`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/reupload/route.ts
git commit -m "feat: POST /api/reupload to accept and replace a document"
```

---

### Task 10: End-to-end verification + full build

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck + lint + production build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all three PASS (build compiles every new route/page).

- [ ] **Step 2: Edit flow E2E**

`npm run dev` → `/admin/vendors/<id>` → Edit → change a required field to invalid (blank company name) → Save blocked with inline error → fix + change several fields → Save → values persist after reload.

- [ ] **Step 3: Re-upload flow E2E (Mailpit running)**

On a vendor with a document, click **Request new file** → "Re-upload email sent". In Mailpit open the email → click the `/reupload/<token>` link → upload a fresh PDF → "Upload received". Back on the vendor detail page, reload → the documents list shows the new file and the old one is gone (replaced). Re-open the same `/reupload/<token>` link → "Already uploaded".

- [ ] **Step 4: Final commit (if any incidental fixes were needed)**

```bash
git add -A
git commit -m "chore: verify vendor edit + document re-upload end to end"
```

---

## Self-Review notes (author)

- **Spec coverage:** Inline edit (Part 1) → Tasks 2-4. Document re-upload (Part 2) → model T1, labels/token/email T5, create-request API T6, admin button T7, public page+form T8, upload API T9. All spec sections mapped.
- **Type consistency:** `VendorFields` (T4) ↔ `vendorEditSchema` fields (T2) ↔ `prisma.vendor.update` data (T3) all cover the same 25 scalar keys. `documentReuploadEmail(link, company, docLabel)` signature matches its call in T6. `DocumentRequest` fields used in T6/T8/T9 match the model in T1. `docLabel`/`DOC_LABELS` single source in T5.
- **Replace semantics:** old doc deleted only after the new row is committed (T9), and never fails the upload — matches the "replace (delete old)" decision and the "documentId may dangle" risk in the spec.
- **No test runner:** verification is typecheck + lint + build + manual, per Global Constraints — deliberate, matches the repo.
