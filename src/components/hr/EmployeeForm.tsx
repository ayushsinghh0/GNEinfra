"use client";
import { useRef, useState, FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "@/components/ui";
import { EMP_CATEGORIES, FAMILY_RELATIONS, EMPLOYEE_POSITIONS } from "@/lib/hr-validation";
import { AlertCircle, Plus, Trash2, Users } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";
import { useUnsavedGuard } from "./useUnsavedGuard";

type Values = Record<string, string>;

// One repeatable family / next-of-kin row. `_k` is a client-only stable React
// key (rows can be added/removed) and is never sent to the server. All fields
// are strings in the form; the server (familyMemberSchema) coerces booleans/%.
export type FamilyRow = {
  name: string; relation: string; dob: string; gender: string;
  occupation: string; contact: string;
  isDependent: boolean; isNominee: boolean; nomineePct: string;
};
type FamilyRowK = FamilyRow & { _k: number };

const EMPTY_MEMBER: FamilyRow = {
  name: "", relation: "Spouse", dob: "", gender: "", occupation: "", contact: "",
  isDependent: false, isNominee: false, nomineePct: "",
};

// Server payload (drops the client-only `_k`); also the dirty-check baseline.
function familyPayload(f: FamilyRowK[]): FamilyRow[] {
  return f.map((m) => ({
    name: m.name, relation: m.relation, dob: m.dob, gender: m.gender,
    occupation: m.occupation, contact: m.contact,
    isDependent: m.isDependent, isNominee: m.isNominee, nomineePct: m.nomineePct,
  }));
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <legend className="px-1.5 text-[13px] font-semibold text-slate-700">{title}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

const EMPTY: Values = {
  empId: "", name: "", designation: "", band: "", empCategory: "On-Roll", location: "",
  dateOfJoining: "", payrollType: "", mailId: "", emergencyNumber: "", bloodGroup: "",
  iCardNo: "", dob: "", offerLetterDate: "", leavingDate: "",
  casualLeaveQuota: "12", sickLeaveQuota: "12",
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

export default function EmployeeForm({
  id,
  initial,
  initialFamily,
}: {
  id?: string;
  initial?: Values;
  initialFamily?: FamilyRow[];
}) {
  const router = useRouter();
  const [v, setV] = useState<Values>({ ...EMPTY, ...(initial ?? {}) });

  // Designation is a preset dropdown + "Other" (free-text). "Other" is on when
  // the seeded designation isn't one of the presets (custom/legacy title).
  const presets: readonly string[] = EMPLOYEE_POSITIONS;
  const [designationOther, setDesignationOther] = useState<boolean>(
    () => !!v.designation && !presets.includes(v.designation)
  );

  // Family rows — seeded once at mount (this instance is remounted via key={id}
  // on employee-to-employee navigation, so the seed never goes stale). Initial
  // rows key off their index; new rows draw from a counter that starts past
  // them (bumped only in the add handler, never during render).
  const [family, setFamily] = useState<FamilyRowK[]>(() =>
    (initialFamily ?? []).map((m, i) => ({ ...m, _k: i }))
  );
  const keyRef = useRef((initialFamily ?? []).length);
  const [seedFamily] = useState(() => JSON.stringify(familyPayload(family)));
  const addMember = () => setFamily((f) => [...f, { ...EMPTY_MEMBER, _k: keyRef.current++ }]);
  const removeMember = (k: number) => setFamily((f) => f.filter((m) => m._k !== k));
  const updateMember = (k: number, patch: Partial<FamilyRow>) =>
    setFamily((f) => f.map((m) => (m._k === k ? { ...m, ...patch } : m)));
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

  const dirty = isDirty(v, seed) || JSON.stringify(familyPayload(family)) !== seedFamily;
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
        body: JSON.stringify({ ...v, familyMembers: familyPayload(family) }),
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
        <Field label="Designation" required htmlFor="designation" error={fieldErrors.designation} errorId={fieldErrors.designation ? "designation-error" : undefined}>
          <Select
            id="designation"
            value={designationOther ? "__OTHER__" : v.designation}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "__OTHER__") {
                setDesignationOther(true);
                setV((s) => ({ ...s, designation: "" }));
              } else {
                setDesignationOther(false);
                setV((s) => ({ ...s, designation: val }));
              }
              setFieldErrors((fe) => { if (!fe.designation) return fe; const n = { ...fe }; delete n.designation; return n; });
            }}
            required
            aria-required
          >
            <option value="">Select position…</option>
            {EMPLOYEE_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            <option value="__OTHER__">Other…</option>
          </Select>
          {designationOther && (
            <Input className="mt-2" value={v.designation} onChange={set("designation")} placeholder="Enter designation" aria-label="Custom designation" />
          )}
        </Field>
        {Txt("band", "Band")}
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

      {/* Pay, bank and statutory details live on the Payroll page (/hr/payroll) —
          salary is decided later, so they're intentionally not on this form. */}
      <Section title="Leave">
        {Txt("casualLeaveQuota", "Casual Leave Quota", false, "number")}
        {Txt("sickLeaveQuota", "Sick Leave Quota", false, "number")}
      </Section>

      <fieldset className="rounded-2xl border border-slate-200 p-4 sm:p-5">
        <legend className="flex items-center gap-1.5 px-1.5 text-[13px] font-semibold text-slate-700">
          <Users className="h-4 w-4 text-slate-400" />
          Family details
        </legend>
        {family.length === 0 ? (
          <p className="text-sm text-slate-400">No family members added yet.</p>
        ) : (
          <div className="space-y-4">
            {family.map((m, idx) => (
              <div key={m._k} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Member {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeMember(m._k)}
                    className="press inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Name" required htmlFor={`fm-name-${m._k}`}>
                    <Input id={`fm-name-${m._k}`} value={m.name} onChange={(e) => updateMember(m._k, { name: e.target.value })} />
                  </Field>
                  <Field label="Relation" required htmlFor={`fm-rel-${m._k}`}>
                    <Select id={`fm-rel-${m._k}`} value={m.relation} onChange={(e) => updateMember(m._k, { relation: e.target.value })}>
                      {FAMILY_RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </Select>
                  </Field>
                  <Field label="Date of Birth" htmlFor={`fm-dob-${m._k}`}>
                    <Input id={`fm-dob-${m._k}`} type="date" value={m.dob} onChange={(e) => updateMember(m._k, { dob: e.target.value })} />
                  </Field>
                  <Field label="Gender" htmlFor={`fm-gender-${m._k}`}>
                    <Input id={`fm-gender-${m._k}`} value={m.gender} onChange={(e) => updateMember(m._k, { gender: e.target.value })} />
                  </Field>
                  <Field label="Occupation" htmlFor={`fm-occ-${m._k}`}>
                    <Input id={`fm-occ-${m._k}`} value={m.occupation} onChange={(e) => updateMember(m._k, { occupation: e.target.value })} />
                  </Field>
                  <Field label="Contact" htmlFor={`fm-contact-${m._k}`}>
                    <Input id={`fm-contact-${m._k}`} inputMode="tel" value={m.contact} onChange={(e) => updateMember(m._k, { contact: e.target.value })} />
                  </Field>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={m.isDependent}
                      onChange={(e) => updateMember(m._k, { isDependent: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand/40"
                    />
                    Dependent
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={m.isNominee}
                      onChange={(e) => updateMember(m._k, { isNominee: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand/40"
                    />
                    Nominee
                  </label>
                  {m.isNominee && (
                    <label className="flex items-center gap-2 text-sm text-slate-500">
                      Share
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        inputMode="numeric"
                        value={m.nomineePct}
                        onChange={(e) => updateMember(m._k, { nomineePct: e.target.value })}
                        className="h-9 w-20"
                        aria-label={`Nominee share % for member ${idx + 1}`}
                      />
                      %
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4">
          <Button type="button" variant="secondary" onClick={addMember}>
            <Plus className="h-4 w-4" />
            Add family member
          </Button>
        </div>
      </fieldset>

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
