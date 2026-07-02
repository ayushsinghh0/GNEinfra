"use client";
import { useState, FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "@/components/ui";
import { EMP_CATEGORIES } from "@/lib/hr-validation";
import { AlertCircle } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";
import { useUnsavedGuard } from "./useUnsavedGuard";

type Values = Record<string, string>;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <legend className="px-1.5 text-[13px] font-semibold text-slate-700">{title}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

const EMPTY: Values = {
  empId: "", name: "", designation: "", empCategory: "On-Roll", location: "",
  dateOfJoining: "", payrollType: "", mailId: "", emergencyNumber: "", bloodGroup: "",
  iCardNo: "", dob: "", offerLetterDate: "", leavingDate: "",
  totalCtc: "", salary: "", lta: "", specialAllowance: "", conveyance: "",
  casualLeaveQuota: "12", sickLeaveQuota: "12",
  bankAccountNo: "", bankName: "", ifsc: "", uan: "", panNo: "", esicNo: "",
};

// Mirrors employeeSchema's required fields (src/lib/hr-validation.ts) — the
// server contract is unchanged, this is purely a fast local pre-check so a
// blank-required-field submit gets an inline, field-associated error instead
// of a single generic banner the user has to hunt for across 5 sections.
const REQUIRED_FIELDS: [key: string, label: string][] = [
  ["empId", "EMP ID"],
  ["name", "Name"],
  ["designation", "Designation"],
  ["empCategory", "Emp Category"],
  ["location", "Location"],
  ["dateOfJoining", "Date of Joining"],
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(v: Values): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [k, label] of REQUIRED_FIELDS) {
    if (!v[k]?.trim()) errors[k] = `${label} is required`;
  }
  if (v.mailId.trim() && !EMAIL_RE.test(v.mailId.trim())) {
    errors.mailId = "Enter a valid email";
  }
  return errors;
}

// True if any field differs from the seeded initial values — drives both the
// unsaved-changes guard and the Cancel confirm.
function isDirty(a: Values, b: Values): boolean {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if ((a[k] ?? "") !== (b[k] ?? "")) return true;
  }
  return false;
}

export default function EmployeeForm({ id, initial }: { id?: string; initial?: Values }) {
  const router = useRouter();
  const [v, setV] = useState<Values>({ ...EMPTY, ...(initial ?? {}) });
  // Captured once at mount via a lazy initializer (this instance is
  // remounted via `key={id}` on employee-to-employee navigation, so the
  // seed never goes stale) — the comparison baseline for the dirty check
  // below. `useState` (not `useRef`) so reading it during render is safe.
  const [seed] = useState<Values>(() => v);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setV((s) => ({ ...s, [k]: e.target.value }));
    setFieldErrors((fe) => {
      if (!fe[k]) return fe;
      const next = { ...fe };
      delete next[k];
      return next;
    });
  };

  const dirty = isDirty(v, seed);
  useUnsavedGuard(dirty, "You have unsaved changes on this form. Leave without saving?");

  function handleCancel() {
    if (dirty) { setDiscardOpen(true); return; }
    router.back();
  }

  async function doSave() {
    setError(null); setBusy(true);
    try {
      const res = await fetch(id ? `/api/hr/employees/${id}` : "/api/hr/employees", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not save");
      setConfirmOpen(false);
      toast(id ? "Changes saved" : "Employee added");
      router.push(id ? `/hr/employees/${id}` : `/hr/employees/${d.employee.id}`);
      router.refresh();
    } catch (err) {
      setConfirmOpen(false);
      setError(err instanceof Error ? err.message : "Could not save");
    } finally { setBusy(false); }
  }

  // Client-side pre-check, then confirm before creating; edits save directly.
  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const errors = validate(v);
    setFieldErrors(errors);
    const firstKey = Object.keys(errors)[0];
    if (firstKey) {
      setError("Please fix the highlighted field(s) before saving.");
      document.getElementById(firstKey)?.focus();
      return;
    }
    if (!id) { setConfirmOpen(true); return; }
    doSave();
  }

  const Txt = (k: string, label: string, req = false, type = "text", inputMode?: "numeric" | "decimal" | "text") => {
    const err = fieldErrors[k];
    const errId = `${k}-error`;
    return (
      <Field label={label} required={req} htmlFor={k} error={err} errorId={err ? errId : undefined}>
        <Input
          id={k}
          type={type}
          value={v[k]}
          onChange={set(k)}
          inputMode={inputMode}
          required={req}
          aria-required={req || undefined}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? errId : undefined}
        />
      </Field>
    );
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      <Section title="Identity & Role">
        {Txt("empId", "EMP ID", true)}
        {Txt("name", "Name", true)}
        {Txt("designation", "Designation", true)}
        <Field label="Emp Category" required htmlFor="empCategory">
          <Select id="empCategory" value={v.empCategory} onChange={set("empCategory")} required aria-required>
            {EMP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        {Txt("location", "Location", true)}
        {Txt("dateOfJoining", "Date of Joining", true, "date")}
        {Txt("payrollType", "Payroll")}
        {Txt("iCardNo", "I-Card No")}
      </Section>

      <Section title="Contact & Personal">
        {Txt("mailId", "Mail Id", false, "email")}
        {Txt("emergencyNumber", "Emergency Number")}
        {Txt("bloodGroup", "Blood Group")}
        {Txt("dob", "DOB", false, "date")}
        {Txt("offerLetterDate", "Offer Letter Date", false, "date")}
        {Txt("leavingDate", "Leaving Date", false, "date")}
      </Section>

      <Section title="Compensation">
        {Txt("totalCtc", "Total CTC (₹)", false, "text", "numeric")}
        {Txt("salary", "Salary (₹)", false, "text", "numeric")}
        {Txt("lta", "LTA (₹)", false, "text", "numeric")}
        {Txt("specialAllowance", "Special Allowance (₹)", false, "text", "numeric")}
        {Txt("conveyance", "Conveyance (₹)", false, "text", "numeric")}
      </Section>

      <Section title="Statutory & Leave">
        {Txt("bankAccountNo", "Bank A/C No")}
        {Txt("bankName", "Bank Name")}
        {Txt("ifsc", "IFSC")}
        {Txt("panNo", "PAN No")}
        {Txt("uan", "UAN (PF)")}
        {Txt("esicNo", "ESIC No")}
        {Txt("casualLeaveQuota", "Casual Leave Quota", false, "number")}
        {Txt("sickLeaveQuota", "Sick Leave Quota", false, "number")}
      </Section>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : id ? "Save changes" : "Add employee"}</Button>
        <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Add this employee?"
        message={`This will create a new employee record${v.name ? ` for ${v.name}` : ""}.`}
        confirmLabel="Add employee"
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={doSave}
      />

      <ConfirmDialog
        open={discardOpen}
        title="Discard unsaved changes?"
        message="You have unsaved changes on this form. Leaving now will lose them."
        confirmLabel="Discard changes"
        variant="danger"
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => { setDiscardOpen(false); router.back(); }}
      />
    </form>
  );
}
