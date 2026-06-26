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

// The 20 editable vendor scalar fields, as strings (empty string = blank).
// Legacy tax fields (exciseNo, tinNo, vatLstNo, cstNo, serviceTaxNo) are kept
// in the DB but removed from the admin edit form — too archaic to bother admins.
export type VendorFields = {
  companyName: string;
  contactPerson: string;
  mobileNumber: string;
  email: string;
  address: string;
  state: string;
  country: string;
  pinCode: string;
  website: string;
  dateOfIncorporation: string; // YYYY-MM-DD or ""
  yearsOfService: string;
  annualTurnover: string;
  gstNo: string;
  panNo: string;
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
  country: "Country",
  pinCode: "PIN Code",
  website: "Website",
  dateOfIncorporation: "Date of Incorporation",
  yearsOfService: "Years of Service",
  annualTurnover: "Annual Turnover",
  gstNo: "GST No",
  panNo: "PAN No",
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
  // PAN optional (matches the vendor wizard's "Has PAN" toggle); format checked when present.
  panNo: validatePan,
  ifscCode: validateIfsc,
};

const REQUIRED = new Set<FieldKey>([
  "companyName",
  "contactPerson",
  "mobileNumber",
  "email",
]);

const COMPANY: FieldKey[] = [
  "companyName",
  "contactPerson",
  "mobileNumber",
  "email",
  "address",
  "state",
  "country",
  "pinCode",
  "website",
  "dateOfIncorporation",
  "yearsOfService",
  "annualTurnover",
];
const STATUTORY: FieldKey[] = [
  "gstNo",
  "panNo",
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
      <dd className="nums text-sm font-medium text-slate-900">
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
      <Button type="button" variant="primary" size="sm" disabled={saving || Object.keys(errors).length > 0} onClick={save}>
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
