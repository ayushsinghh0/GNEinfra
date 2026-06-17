"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { compressFormImages } from "@/lib/compress-image";
import {
  Card,
  CardHeader,
  CardBody,
  Field as UIField,
  Input,
  Textarea,
  Select,
  Button,
  btn,
  cn,
} from "@/components/ui";
import {
  validateRequired,
  validateCompanyName,
  validateEmail,
  validateMobile,
  validateGst,
  validatePan,
  validateIfsc,
  MAX_LEN,
  type FieldError,
} from "@/lib/vendor-validation";
import {
  Building2,
  ShieldCheck,
  Banknote,
  Briefcase,
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  Check,
  Pencil,
  X,
  Lock,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type ProjectRow = {
  clientName: string;
  capacity: string;
  projectType: string;
  contractType: string;
  location: string;
  yearOfCompletion: string;
  scopeOfWork: string;
  percentCompleted: string;
  remarks: string;
};

const emptyRow = (): ProjectRow => ({
  clientName: "",
  capacity: "",
  projectType: "",
  contractType: "",
  location: "",
  yearOfCompletion: "",
  scopeOfWork: "",
  percentCompleted: "",
  remarks: "",
});

// Every scalar text/date field on the form. File inputs stay native (see below).
type FormState = {
  companyName: string;
  contactPerson: string;
  mobileNumber: string;
  email: string;
  address: string;
  state: string;
  website: string;
  dateOfIncorporation: string;
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

type FieldName = keyof FormState;

const EMPTY_FORM: FormState = {
  companyName: "",
  contactPerson: "",
  mobileNumber: "",
  email: "",
  address: "",
  state: "",
  website: "",
  dateOfIncorporation: "",
  yearsOfService: "",
  annualTurnover: "",
  gstNo: "",
  panNo: "",
  exciseNo: "",
  tinNo: "",
  vatLstNo: "",
  cstNo: "",
  serviceTaxNo: "",
  msmeNo: "",
  bankName: "",
  bankBranchAddress: "",
  bankAccountNo: "",
  bankBranchCode: "",
  ifscCode: "",
  swiftCode: "",
  ibanCode: "",
};

// Human labels for the review summary.
const LABELS: Record<FieldName, string> = {
  companyName: "Company Name",
  contactPerson: "Contact Person",
  mobileNumber: "Mobile Number",
  email: "Email Address",
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
  bankAccountNo: "Bank Account No",
  bankBranchCode: "Branch Code",
  ifscCode: "IFSC Code",
  swiftCode: "SWIFT Code",
  ibanCode: "IBAN Code",
};

// Field-level validators. Fields not listed here are free-text/optional.
const VALIDATORS: Partial<Record<FieldName, (v: string) => FieldError>> = {
  companyName: validateCompanyName,
  contactPerson: (v) => validateRequired(v, "Contact person"),
  mobileNumber: validateMobile,
  email: validateEmail,
  gstNo: validateGst,
  panNo: validatePan,
  ifscCode: validateIfsc,
};

type StepDef = {
  id: string;
  title: string;
  description: string;
  short: string; // one-line label for the sidebar rail
  icon: React.ReactNode;
  fields: FieldName[]; // fields that gate "Next" on this step
};

const STEPS: StepDef[] = [
  {
    id: "company",
    title: "Company",
    description: "Tell us who you are and how to reach you.",
    short: "Your details & contact",
    icon: <Building2 className="h-4 w-4" />,
    fields: [
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
    ],
  },
  {
    id: "statutory",
    title: "Statutory & Tax",
    description: "Provide the registrations applicable to your business.",
    short: "GST, PAN & tax IDs",
    icon: <ShieldCheck className="h-4 w-4" />,
    fields: ["gstNo", "panNo", "exciseNo", "tinNo", "vatLstNo", "cstNo", "serviceTaxNo", "msmeNo"],
  },
  {
    id: "bank",
    title: "Bank",
    description: "Used for payments and bank verification.",
    short: "Account for payments",
    icon: <Banknote className="h-4 w-4" />,
    fields: ["bankName", "bankBranchAddress", "bankAccountNo", "bankBranchCode", "ifscCode", "swiftCode", "ibanCode"],
  },
  {
    id: "projects",
    title: "Past Projects",
    description: "List solar/wind projects you have executed. Add as many rows as needed.",
    short: "Your track record",
    icon: <Briefcase className="h-4 w-4" />,
    fields: [],
  },
  {
    id: "documents",
    title: "Documents",
    description: "A cancelled cheque copy is recommended for bank verification.",
    short: "Cheque & certificates",
    icon: <FileText className="h-4 w-4" />,
    fields: [],
  },
];

const LAST = STEPS.length - 1;
const DOC_STEP = STEPS.findIndex((s) => s.id === "documents");

// Max length per field, mirroring the server schema (company/contact/email 200,
// everything else 500). Used as input maxLength so over-long input never reaches
// a server 400.
const MAX_BY_FIELD: Partial<Record<FieldName, number>> = {
  companyName: MAX_LEN.name,
  contactPerson: MAX_LEN.name,
  email: MAX_LEN.email,
};

const DOC_FIELDS: { name: string; label: string; hint?: string; multiple?: boolean }[] = [
  { name: "cancelledCheque", label: "Cancelled Cheque", hint: "recommended" },
  { name: "gstCertificate", label: "GST Certificate" },
  { name: "panCard", label: "PAN Card" },
  { name: "otherDocs", label: "Other Documents", multiple: true },
];

// Mirror the server's accepted document types + size cap (src/lib/documents.ts)
// so an unsupported/oversize file is caught BEFORE the single-use link is spent.
const ALLOWED_DOC_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_DOC_BYTES = 10 * 1024 * 1024;

function validateFiles(files: File[]): string | null {
  for (const f of files) {
    if (f.size > MAX_DOC_BYTES) return `"${f.name}" is larger than 10 MB`;
    if (!f.type || !ALLOWED_DOC_TYPES.includes(f.type.toLowerCase()))
      return `"${f.name}" must be a PDF, JPG, PNG or WEBP file`;
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RegistrationForm({
  token,
  defaultEmail,
  defaultCompany,
}: {
  token: string;
  defaultEmail?: string;
  defaultCompany?: string;
}) {
  const storageKey = `gne-vendor-draft:${token}`;
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const terminalRef = useRef<HTMLHeadingElement>(null);

  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY_FORM,
    email: defaultEmail ?? "",
    companyName: defaultCompany ?? "",
  }));
  const [projects, setProjects] = useState<ProjectRow[]>([emptyRow()]);
  const [fileNames, setFileNames] = useState<Record<string, string[]>>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});

  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [stepError, setStepError] = useState(false);

  const [showReview, setShowReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [docWarnings, setDocWarnings] = useState<string[] | null>(null);
  const [terminal, setTerminal] = useState<{ title: string; body: string } | null>(null);

  const [ready, setReady] = useState(false);

  const focusFieldRef = useRef<string | null>(null);
  const skipSave = useRef(true);

  const focusField = useCallback((name: string) => {
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${name}"]`);
    el?.focus();
    el?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, []);

  // Restore any locally-saved draft once, on the client, THEN reveal the form
  // (ready=true). Gating the editable form behind `ready` keeps the server HTML
  // and the first client render identical (no hydration mismatch) and removes the
  // window where a user could type before the draft is restored.
  useEffect(() => {
    let draft: { form?: Partial<FormState>; projects?: ProjectRow[] } | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) draft = JSON.parse(raw);
    } catch {
      /* ignore unreadable / unavailable storage */
    }
    /* eslint-disable react-hooks/set-state-in-effect -- one-time client hydration + reveal */
    if (draft?.form) setForm((f) => ({ ...f, ...draft!.form }));
    if (Array.isArray(draft?.projects) && draft.projects.length) setProjects(draft.projects);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [storageKey]);

  // Autosave typed answers (text only — never files).
  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    if (done) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ form, projects }));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, [form, projects, done, storageKey]);

  // After a step becomes visible, move focus to the pending field (if any).
  useEffect(() => {
    const name = focusFieldRef.current;
    if (!name) return;
    focusFieldRef.current = null;
    focusField(name);
  }, [step, focusField]);

  // Announce success / dead-link to assistive tech and move focus to its heading.
  useEffect(() => {
    if (done) successRef.current?.focus();
  }, [done]);
  useEffect(() => {
    if (terminal) terminalRef.current?.focus();
  }, [terminal]);

  function setField(name: FieldName, value: string) {
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name] || touched[name]) {
      const v = VALIDATORS[name];
      const msg = v ? v(value) : null;
      setErrors((e) => {
        const next = { ...e };
        if (msg) next[name] = msg;
        else delete next[name];
        return next;
      });
    }
  }

  function blurField(name: FieldName) {
    setTouched((t) => ({ ...t, [name]: true }));
    const v = VALIDATORS[name];
    if (!v) return;
    const msg = v(form[name]);
    setErrors((e) => {
      const next = { ...e };
      if (msg) next[name] = msg;
      else delete next[name];
      return next;
    });
  }

  function checkFields(fields: FieldName[]): Partial<Record<FieldName, string>> {
    const found: Partial<Record<FieldName, string>> = {};
    for (const name of fields) {
      const v = VALIDATORS[name];
      if (!v) continue;
      const msg = v(form[name]);
      if (msg) found[name] = msg;
    }
    return found;
  }

  function onFilesSelected(name: string, files: File[]) {
    setFileNames((m) => ({ ...m, [name]: files.map((f) => f.name) }));
    const err = validateFiles(files);
    setFileErrors((m) => {
      const next = { ...m };
      if (err) next[name] = err;
      else delete next[name];
      return next;
    });
  }

  function goNext() {
    const fields = STEPS[step].fields;
    const found = checkFields(fields);
    if (Object.keys(found).length) {
      setErrors((e) => ({ ...e, ...found }));
      setTouched((t) => {
        const nt = { ...t };
        fields.forEach((f) => (nt[f] = true));
        return nt;
      });
      setStepError(true);
      focusField(Object.keys(found)[0]);
      return;
    }
    if (step === DOC_STEP) {
      const badField = Object.keys(fileErrors).find((k) => fileErrors[k]);
      if (badField) {
        setStepError(true);
        focusField(badField);
        return;
      }
    }
    setStepError(false);
    const next = Math.min(step + 1, LAST);
    setStep(next);
    setMaxStep((m) => Math.max(m, next));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setStepError(false);
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToStep(i: number) {
    if (i > maxStep) return;
    setStepError(false);
    setStep(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editStep(i: number) {
    setShowReview(false);
    setStep(i);
    setMaxStep((m) => Math.max(m, i));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openReview() {
    const allFields = STEPS.flatMap((s) => s.fields);
    const found = checkFields(allFields);
    if (Object.keys(found).length) {
      const firstField = Object.keys(found)[0] as FieldName;
      const stepIdx = STEPS.findIndex((s) => s.fields.includes(firstField));
      setErrors((e) => ({ ...e, ...found }));
      setTouched((t) => {
        const nt = { ...t };
        (Object.keys(found) as FieldName[]).forEach((f) => (nt[f] = true));
        return nt;
      });
      setStepError(true);
      if (stepIdx >= 0 && stepIdx !== step) {
        focusFieldRef.current = firstField;
        setStep(stepIdx);
        setMaxStep((m) => Math.max(m, stepIdx));
      } else {
        focusField(firstField);
      }
      return;
    }
    const badFile = Object.keys(fileErrors).find((k) => fileErrors[k]);
    if (badFile) {
      setStepError(true);
      setMaxStep(LAST);
      if (step !== DOC_STEP) {
        focusFieldRef.current = badFile;
        setStep(DOC_STEP);
      } else {
        focusField(badFile);
      }
      return;
    }
    setMaxStep(LAST);
    setSubmitError(null);
    setShowReview(true);
  }

  // Route a server-side validation rejection (the backstop) back to the field.
  function applyServerIssues(issues: { field: string; message: string }[]) {
    const mapped: Partial<Record<FieldName, string>> = {};
    for (const it of issues) {
      if (it.field in EMPTY_FORM) mapped[it.field as FieldName] = it.message;
    }
    if (!Object.keys(mapped).length) {
      setSubmitError(issues[0]?.message || "Please review your details and try again.");
      return;
    }
    setErrors((e) => ({ ...e, ...mapped }));
    setTouched((t) => {
      const nt = { ...t };
      (Object.keys(mapped) as FieldName[]).forEach((f) => (nt[f] = true));
      return nt;
    });
    setShowReview(false);
    setStepError(true);
    const firstField = Object.keys(mapped)[0] as FieldName;
    const stepIdx = STEPS.findIndex((s) => s.fields.includes(firstField));
    if (stepIdx >= 0 && stepIdx !== step) {
      focusFieldRef.current = firstField;
      setStep(stepIdx);
    } else {
      focusField(firstField);
    }
  }

  async function doSubmit() {
    const formEl = formRef.current;
    if (!formEl) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const fd = new FormData(formEl);
      fd.set("token", token);
      const filled = projects.filter((p) => Object.values(p).some((v) => v.trim() !== ""));
      fd.set("projects", JSON.stringify(filled.map((p, i) => ({ ...p, serialNo: i + 1 }))));
      await compressFormImages(formEl, fd);

      const res = await fetch("/api/register", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409 || res.status === 410 || res.status === 403) {
          try {
            localStorage.removeItem(storageKey);
          } catch {
            /* ignore */
          }
          setShowReview(false);
          setTerminal({
            title:
              res.status === 410 ? "Link expired" : res.status === 403 ? "Link revoked" : "Already submitted",
            body:
              data.error ||
              "This registration link can no longer be used. Please contact GNE procurement for a new one.",
          });
          return;
        }
        if (res.status === 400 && Array.isArray(data.issues) && data.issues.length) {
          applyServerIssues(data.issues);
          return;
        }
        throw new Error(data.error || "Submission failed. Please try again.");
      }

      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
      setShowReview(false);
      setDocWarnings(Array.isArray(data.docWarnings) && data.docWarnings.length ? data.docWarnings : null);
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render helpers ───────────────────────────────────────────────────────

  function tf(
    name: FieldName,
    opts: {
      required?: boolean;
      type?: string;
      hint?: string;
      placeholder?: string;
      className?: string;
      inputMode?: "text" | "tel" | "email" | "url";
    } = {}
  ) {
    const hasErr = Boolean(touched[name] && errors[name]);
    const errId = `${name}-error`;
    return (
      <UIField
        label={LABELS[name]}
        required={opts.required}
        hint={opts.hint}
        error={hasErr ? errors[name] : undefined}
        errorId={hasErr ? errId : undefined}
        className={opts.className}
      >
        <Input
          name={name}
          type={opts.type ?? "text"}
          inputMode={opts.inputMode}
          maxLength={MAX_BY_FIELD[name] ?? MAX_LEN.text}
          value={form[name]}
          placeholder={opts.placeholder}
          onChange={(e) => setField(name, e.target.value)}
          onBlur={() => blurField(name)}
          aria-invalid={hasErr || undefined}
          aria-describedby={hasErr ? errId : undefined}
          className={
            hasErr ? "border-rose-400 focus:border-rose-400 focus:ring-rose-100/70" : undefined
          }
        />
      </UIField>
    );
  }

  function updateRow(i: number, key: keyof ProjectRow, value: string) {
    setProjects((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }

  // ── Content per state ──────────────────────────────────────────────────────

  const isCard = !ready || Boolean(terminal) || done;
  let content: React.ReactNode;

  if (!ready) {
    content = (
      <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-6 py-10 text-sm text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
        Loading your registration form…
      </div>
    );
  } else if (terminal) {
    content = (
      <div
        role="alert"
        className="w-full max-w-lg rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h1 ref={terminalRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-slate-900 outline-none">
          {terminal.title}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{terminal.body}</p>
      </div>
    );
  } else if (done) {
    content = (
      <div
        role="status"
        aria-live="polite"
        className="w-full max-w-lg rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h1 ref={successRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-slate-900 outline-none">
          Registration submitted
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Thank you. We&apos;ve received your details and emailed you a confirmation. Our procurement team
          will review and get in touch. This registration link is now closed.
        </p>
        {docWarnings && (
          <div className="mx-auto mt-5 max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-700">
            <p className="font-medium">Some documents couldn&apos;t be saved:</p>
            <ul className="mt-1 list-disc pl-5">
              {docWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs">Please email these to GNE procurement so your file is complete.</p>
          </div>
        )}
      </div>
    );
  } else {
    const visibleFieldErrors = STEPS[step].fields.filter((f) => touched[f] && errors[f]);
    const visibleFileError = step === DOC_STEP && Object.values(fileErrors).some(Boolean);
    const showStepBanner = stepError && (visibleFieldErrors.length > 0 || visibleFileError);

    content = (
      <>
        <form ref={formRef} onSubmit={(e) => e.preventDefault()} noValidate className="space-y-6">
          {showStepBanner && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Please fix the highlighted items on this step before continuing.</span>
            </div>
          )}

          {/* Step 0 — Company */}
          <div className={step === 0 ? "block animate-step-in" : "hidden"}>
            <Section title="Company Information" description={STEPS[0].description} icon={STEPS[0].icon}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {tf("companyName", { required: true })}
                {tf("contactPerson", { required: true })}
                {tf("mobileNumber", { required: true, type: "tel", inputMode: "tel", hint: "10-digit Indian mobile", placeholder: "98765 43210" })}
                {tf("email", { required: true, type: "email", inputMode: "email" })}
                <UIField label="Address" className="md:col-span-2">
                  <Textarea
                    name="address"
                    rows={2}
                    maxLength={MAX_LEN.text}
                    value={form.address}
                    onChange={(e) => setField("address", e.target.value)}
                  />
                </UIField>
                {tf("state")}
                {tf("website", { type: "url", inputMode: "url", placeholder: "https://" })}
                {tf("dateOfIncorporation", { type: "date" })}
                {tf("yearsOfService")}
                {tf("annualTurnover")}
              </div>
            </Section>
          </div>

          {/* Step 1 — Statutory & Tax */}
          <div className={step === 1 ? "block animate-step-in" : "hidden"}>
            <Section title="Statutory & Tax Registration" description={STEPS[1].description} icon={STEPS[1].icon}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {tf("gstNo", { required: true, hint: "15 characters", placeholder: "22AAAAA0000A1Z5" })}
                {tf("panNo", { required: true, hint: "10 characters", placeholder: "ABCDE1234F" })}
                {tf("exciseNo", { hint: "if applicable" })}
                {tf("tinNo", { hint: "if applicable" })}
                {tf("vatLstNo", { hint: "if applicable" })}
                {tf("cstNo", { hint: "if applicable" })}
                {tf("serviceTaxNo", { hint: "if applicable" })}
                {tf("msmeNo", { hint: "if applicable" })}
              </div>
            </Section>
          </div>

          {/* Step 2 — Bank */}
          <div className={step === 2 ? "block animate-step-in" : "hidden"}>
            <Section title="Bank Details" description={STEPS[2].description} icon={STEPS[2].icon}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {tf("bankName")}
                {tf("bankBranchAddress")}
                {tf("bankAccountNo")}
                {tf("bankBranchCode")}
                {tf("ifscCode", { placeholder: "HDFC0001234" })}
                {tf("swiftCode", { hint: "foreign vendors" })}
                {tf("ibanCode", { hint: "foreign suppliers" })}
              </div>
            </Section>
          </div>

          {/* Step 3 — Past Projects */}
          <div className={step === 3 ? "block animate-step-in" : "hidden"}>
            <Section title="Past Projects" description={STEPS[3].description} icon={STEPS[3].icon}>
              <div className="space-y-4">
                {projects.map((row, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-50 text-xs font-bold text-brand-700 tabular-nums">
                          {i + 1}
                        </span>
                        Project {i + 1}
                      </span>
                      {projects.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setProjects((r) => r.filter((_, idx) => idx !== i))}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Remove project"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <UIField label="Client">
                        <Input value={row.clientName} maxLength={MAX_LEN.text} onChange={(e) => updateRow(i, "clientName", e.target.value)} />
                      </UIField>
                      <UIField label="Capacity">
                        <Input value={row.capacity} maxLength={MAX_LEN.text} onChange={(e) => updateRow(i, "capacity", e.target.value)} placeholder="e.g. 50 MW" />
                      </UIField>
                      <UIField label="Type">
                        <Select value={row.projectType} onChange={(e) => updateRow(i, "projectType", e.target.value)}>
                          <option value="">—</option>
                          <option>Solar</option>
                          <option>Wind</option>
                        </Select>
                      </UIField>
                      <UIField label="EPC / I&C / BOS">
                        <Select value={row.contractType} onChange={(e) => updateRow(i, "contractType", e.target.value)}>
                          <option value="">—</option>
                          <option>EPC</option>
                          <option>I&C</option>
                          <option>BOS</option>
                        </Select>
                      </UIField>
                      <UIField label="Location">
                        <Input value={row.location} maxLength={MAX_LEN.text} onChange={(e) => updateRow(i, "location", e.target.value)} />
                      </UIField>
                      <UIField label="Year of Completion">
                        <Input value={row.yearOfCompletion} maxLength={MAX_LEN.text} onChange={(e) => updateRow(i, "yearOfCompletion", e.target.value)} placeholder="e.g. 2023" />
                      </UIField>
                      <UIField label="% Completed">
                        <Input value={row.percentCompleted} maxLength={MAX_LEN.text} onChange={(e) => updateRow(i, "percentCompleted", e.target.value)} placeholder="e.g. 100" />
                      </UIField>
                      <UIField label="Scope of Work" className="sm:col-span-2 lg:col-span-2">
                        <Input value={row.scopeOfWork} maxLength={MAX_LEN.text} onChange={(e) => updateRow(i, "scopeOfWork", e.target.value)} />
                      </UIField>
                      <UIField label="Remarks" className="sm:col-span-2 lg:col-span-3">
                        <Input value={row.remarks} maxLength={MAX_LEN.text} onChange={(e) => updateRow(i, "remarks", e.target.value)} />
                      </UIField>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setProjects((r) => [...r, emptyRow()])}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:border-brand hover:bg-brand-50/40"
              >
                <Plus className="h-4 w-4" />
                Add another project
              </button>
            </Section>
          </div>

          {/* Step 4 — Documents */}
          <div className={step === 4 ? "block animate-step-in" : "hidden"}>
            <Section title="Documents" description={STEPS[4].description} icon={STEPS[4].icon}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {DOC_FIELDS.map((d) => (
                  <FileField
                    key={d.name}
                    name={d.name}
                    label={d.label}
                    hint={d.hint}
                    multiple={d.multiple}
                    names={fileNames[d.name] ?? []}
                    error={fileErrors[d.name]}
                    onSelect={onFilesSelected}
                  />
                ))}
              </div>
            </Section>
          </div>
        </form>

        {/* Sticky action bar */}
        <div
          className="sticky bottom-0 z-10 mt-6 flex items-center justify-between gap-3 border-t border-slate-200/70 bg-canvas/85 py-3 backdrop-blur"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div>
            {step > 0 && (
              <button type="button" onClick={goBack} className={btn("secondary", "md")}>
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {step === LAST && (
              <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex">
                <Lock className="h-3.5 w-3.5" />
                Encrypted in transit
              </span>
            )}
            {step < LAST ? (
              <Button type="button" onClick={goNext} className="h-11 px-6 text-sm">
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={openReview} variant="primary" className="h-11 px-7 text-sm">
                Review &amp; Submit
              </Button>
            )}
          </div>
        </div>
      </>
    );
  }

  // ── Shell ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-canvas lg:grid lg:grid-cols-[minmax(300px,360px)_1fr] lg:items-stretch">
      <Rail step={step} maxStep={maxStep} onStep={goToStep} complete={done} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader step={step} complete={done || Boolean(terminal)} />
        <div
          className={cn(
            "mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-8 sm:py-12",
            isCard && "items-center justify-center"
          )}
        >
          {content}
        </div>
      </div>

      {showReview && (
        <ReviewModal
          form={form}
          projects={projects}
          fileNames={fileNames}
          submitting={submitting}
          submitError={submitError}
          onEdit={editStep}
          onClose={() => setShowReview(false)}
          onConfirm={doSubmit}
        />
      )}
    </div>
  );
}

// ── Branded sidebar rail (desktop) ──────────────────────────────────────────────

function Rail({
  step,
  maxStep,
  onStep,
  complete,
}: {
  step: number;
  maxStep: number;
  onStep: (i: number) => void;
  complete: boolean;
}) {
  const pct = complete ? 100 : Math.round(((step + 1) / STEPS.length) * 100);
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-9 overflow-y-auto bg-gradient-to-b from-brand-800 to-brand-900 px-8 py-10 text-white lg:flex xl:px-10">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 font-bold tracking-tight ring-1 ring-inset ring-white/20">
          GNE
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">Vendor Registration</p>
          <p className="text-xs text-brand-100/70">GNE Solar EPC · Supplier onboarding</p>
        </div>
      </div>

      <ol className="space-y-1">
        {STEPS.map((s, i) => {
          const state = complete || i < step ? "done" : i === step ? "current" : "todo";
          const clickable = !complete && i <= maxStep;
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStep(i)}
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  clickable ? "cursor-pointer hover:bg-white/5" : "cursor-default"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums transition-colors",
                    state === "done"
                      ? "bg-white text-brand-700"
                      : state === "current"
                        ? "bg-white/15 text-white ring-2 ring-white"
                        : "bg-white/10 text-brand-100/60"
                  )}
                >
                  {state === "done" ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm font-medium", state === "todo" ? "text-brand-100/60" : "text-white")}>
                    {s.title}
                  </span>
                  <span className="block text-xs text-brand-100/55">{s.short}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-auto space-y-5">
        <div>
          <div className="flex items-center justify-between text-xs text-brand-100/70">
            <span>Progress</span>
            <span className="tabular-nums">{complete ? "Complete" : `Step ${step + 1} of ${STEPS.length}`}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="space-y-2 text-xs text-brand-100/70">
          <p className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-brand-200" />
            Shared only with GNE procurement.
          </p>
          <p className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-200" />
            Your progress saves automatically.
          </p>
        </div>
      </div>
    </aside>
  );
}

// ── Compact header (mobile) ──────────────────────────────────────────────────

function MobileHeader({ step, complete }: { step: number; complete: boolean }) {
  const pct = complete ? 100 : Math.round(((step + 1) / STEPS.length) * 100);
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 px-4 py-3 backdrop-blur lg:hidden">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand text-xs font-bold tracking-tight text-white">
          GNE
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">
            {complete ? "Vendor Registration" : STEPS[step].title}
          </p>
          <p className="text-xs text-slate-500">
            {complete ? "Complete" : `Step ${step + 1} of ${STEPS.length}`}
          </p>
        </div>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </header>
  );
}

// ── File upload field (module scope so it is NOT remounted on every render — a
//    remount would wipe the user's selected files) ──────────────────────────────

function FileField({
  name,
  label,
  hint,
  multiple,
  names,
  error,
  onSelect,
}: {
  name: string;
  label: string;
  hint?: string;
  multiple?: boolean;
  names: string[];
  error?: string;
  onSelect: (name: string, files: File[]) => void;
}) {
  const errId = `${name}-error`;
  return (
    <label
      className={cn(
        "group block cursor-pointer rounded-lg border border-dashed px-4 py-3 transition-colors",
        error
          ? "border-rose-300 bg-rose-50/40"
          : "border-slate-300 bg-slate-50/50 hover:border-brand hover:bg-brand-50/40"
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
        {label}
        {hint && <span className="font-normal text-slate-400">— {hint}</span>}
      </span>
      <span className="mt-1 flex items-center gap-2 text-xs text-slate-400">
        <UploadCloud className="h-4 w-4 text-slate-400 group-hover:text-brand" />
        PDF or image, max 10 MB
      </span>
      <input
        name={name}
        type="file"
        multiple={multiple}
        accept=".pdf,image/*"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
        onChange={(e) => onSelect(name, Array.from(e.target.files ?? []))}
        className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
      />
      {error ? (
        <span id={errId} className="mt-2 block text-xs font-medium text-rose-600">
          {error}
        </span>
      ) : names.length > 0 ? (
        <span className="mt-2 block truncate text-xs font-medium text-emerald-600">{names.join(", ")}</span>
      ) : null}
    </label>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700">{icon}</span>
            {title}
          </span>
        }
        subtitle={description}
      />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

// ── Review (confirmation) modal ────────────────────────────────────────────────

function ReviewModal({
  form,
  projects,
  fileNames,
  submitting,
  submitError,
  onEdit,
  onClose,
  onConfirm,
}: {
  form: FormState;
  projects: ProjectRow[];
  fileNames: Record<string, string[]>;
  submitting: boolean;
  submitError: string | null;
  onEdit: (step: number) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!submitting) onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const node = panelRef.current;
      if (!node) return;
      const focusables = node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (active === node || !node.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [submitting, onClose]);

  if (typeof document === "undefined") return null;

  const rowsFrom = (keys: FieldName[]) =>
    keys.map((k) => ({ label: LABELS[k], value: form[k].trim() })).filter((r) => r.value);

  const sections = [
    { title: "Company Information", step: 0, rows: rowsFrom(STEPS[0].fields) },
    { title: "Statutory & Tax", step: 1, rows: rowsFrom(STEPS[1].fields) },
    { title: "Bank Details", step: 2, rows: rowsFrom(STEPS[2].fields) },
  ];

  const filledProjects = projects.filter((p) => Object.values(p).some((v) => v.trim() !== ""));
  const uploadedDocs = DOC_FIELDS.map((d) => ({ label: d.label, names: fileNames[d.name] ?? [] })).filter(
    (d) => d.names.length > 0
  );

  return createPortal(
    <div className="animate-overlay-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:items-center">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        className="animate-modal-in my-8 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="review-title" className="text-base font-semibold text-slate-900">
              Review your details
            </h2>
            <p className="text-xs text-slate-500">Please check everything is correct before submitting.</p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {sections.map((s) => (
            <ReviewBlock key={s.step} title={s.title} onEdit={() => onEdit(s.step)}>
              {s.rows.length ? (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  {s.rows.map((r) => (
                    <div key={r.label} className="flex justify-between gap-3 border-b border-slate-50 py-1 text-sm">
                      <dt className="text-slate-500">{r.label}</dt>
                      <dd className="break-words text-right font-medium text-slate-800">{r.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm italic text-slate-400">Nothing entered.</p>
              )}
            </ReviewBlock>
          ))}

          <ReviewBlock title="Past Projects" onEdit={() => onEdit(3)}>
            {filledProjects.length ? (
              <ul className="space-y-2">
                {filledProjects.map((p, i) => (
                  <li key={i} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm text-slate-700">
                    <span className="font-medium text-slate-800">{i + 1}.</span>{" "}
                    {[p.clientName, p.capacity, p.projectType, p.location, p.yearOfCompletion]
                      .filter((v) => v.trim())
                      .join(" · ") || "—"}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm italic text-slate-400">No projects added.</p>
            )}
          </ReviewBlock>

          <ReviewBlock title="Documents" onEdit={() => onEdit(4)}>
            {uploadedDocs.length ? (
              <ul className="space-y-1 text-sm text-slate-700">
                {uploadedDocs.map((d) => (
                  <li key={d.label} className="flex justify-between gap-3">
                    <span className="text-slate-500">{d.label}</span>
                    <span className="break-words text-right font-medium text-slate-800">{d.names.join(", ")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm italic text-slate-400">No files attached.</p>
            )}
          </ReviewBlock>
        </div>

        <div className="border-t border-slate-100 px-5 py-4">
          {submitError && (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}
          <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">By submitting, you confirm the details above are accurate.</p>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={onClose} disabled={submitting} className={btn("secondary", "md")}>
                Back to form
              </button>
              <Button type="button" onClick={onConfirm} disabled={submitting} className="px-6">
                {submitting ? "Submitting…" : "Confirm & Submit"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ReviewBlock({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5 last:mb-0">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
      </div>
      {children}
    </section>
  );
}
