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
  Button,
  Skeleton,
  btn,
  cn,
} from "@/components/ui";
import { SunGlow, Atmosphere, Wave, Blob, SuccessCheck } from "@/components/chrome";
import Dropzone from "@/components/Dropzone";
import {
  validateRequired,
  validateCompanyName,
  validateEmail,
  validateMobile,
  validateGst,
  validatePan,
  validateIfsc,
  validatePin,
  MAX_LEN,
  SERVICE_ACTIVITIES,
  OEM_DEALER,
  type FieldError,
} from "@/lib/vendor-validation";
import {
  Building2,
  ShieldCheck,
  Banknote,
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Check,
  Pencil,
  X,
  Lock,
  Tag,
  TrendingUp,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type ProductRow = { name: string; brand: string; model: string };
type ExperienceRow = { financialYear: string; clientProject: string; scope: string; value: string };
type POrow = { poNumber: string; client: string; value: string; poDate: string };
type TurnoverRow = { financialYear: string; amount: string };

const emptyProduct = (): ProductRow => ({ name: "", brand: "", model: "" });
const emptyExperience = (): ExperienceRow => ({ financialYear: "", clientProject: "", scope: "", value: "" });
const emptyPO = (): POrow => ({ poNumber: "", client: "", value: "", poDate: "" });
const emptyTurnover = (): TurnoverRow => ({ financialYear: "", amount: "" });

// PAN is now required in the new 6-step flow.
function validatePanRequired(v: string): FieldError {
  if (!v.trim()) return "PAN is required";
  return validatePan(v);
}

// Every scalar text/date field on the form. File inputs stay native (see below).
type FormState = {
  companyName: string;
  contactPerson: string;
  mobileNumber: string;
  email: string;
  address: string;
  state: string;
  country: string;
  pinCode: string;
  website: string;
  dateOfIncorporation: string;
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

type FieldName = keyof FormState;

const EMPTY_FORM: FormState = {
  companyName: "",
  contactPerson: "",
  mobileNumber: "",
  email: "",
  address: "",
  state: "",
  country: "India",
  pinCode: "",
  website: "",
  dateOfIncorporation: "",
  yearsOfService: "",
  annualTurnover: "",
  gstNo: "",
  panNo: "",
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
  pinCode: validatePin,
  gstNo: validateGst,
  panNo: validatePanRequired,
  ifscCode: validateIfsc,
};

type StepDef = {
  id: string;
  title: string;
  description: string;
  short: string;
  icon: React.ReactNode;
  fields: FieldName[];
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
      "country",
      "pinCode",
      "website",
      "dateOfIncorporation",
      "yearsOfService",
      "annualTurnover",
    ],
  },
  {
    id: "offerings",
    title: "Offerings",
    description: "What services or products does your company offer?",
    short: "Services & products",
    icon: <Tag className="h-4 w-4" />,
    fields: [],
  },
  {
    id: "track-record",
    title: "Track record",
    description: "Share your past project experience and financial turnover.",
    short: "Experience & turnover",
    icon: <TrendingUp className="h-4 w-4" />,
    fields: [],
  },
  {
    id: "statutory",
    title: "Statutory & Tax",
    description: "Provide the registrations applicable to your business.",
    short: "GST, PAN & MSME",
    icon: <ShieldCheck className="h-4 w-4" />,
    fields: ["gstNo", "panNo", "msmeNo"],
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
const OFFERINGS_STEP = STEPS.findIndex((s) => s.id === "offerings");
const STATUTORY_STEP = STEPS.findIndex((s) => s.id === "statutory");

// Max length per field, mirroring the server schema.
const MAX_BY_FIELD: Partial<Record<FieldName, number>> = {
  companyName: MAX_LEN.name,
  contactPerson: MAX_LEN.name,
  email: MAX_LEN.email,
};

const DOC_FIELDS: { name: string; label: string; hint?: string; multiple?: boolean }[] = [
  { name: "cancelledCheque", label: "Cancelled Cheque", hint: "recommended" },
  { name: "gstCertificate", label: "GST Certificate" },
  { name: "panCard", label: "PAN Card" },
  { name: "msmeCertificate", label: "MSME Certificate" },
  { name: "purchaseOrderDocs", label: "Purchase Order Copies", multiple: true },
  { name: "otherDocs", label: "Other Documents", multiple: true },
];

// Mirror the server's accepted document types + size cap.
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

  // Category toggles (Company step)
  const [offersService, setOffersService] = useState(false);
  const [offersProduct, setOffersProduct] = useState(false);

  // Offerings state
  const [serviceActivities, setServiceActivities] = useState<Set<string>>(new Set());
  const [otherServiceDetails, setOtherServiceDetails] = useState("");
  const [oemOrDealer, setOemOrDealer] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([emptyProduct()]);

  // Track record state
  const [experiences, setExperiences] = useState<ExperienceRow[]>([emptyExperience()]);
  const [purchaseOrders, setPurchaseOrders] = useState<POrow[]>([emptyPO()]);
  const [turnovers, setTurnovers] = useState<TurnoverRow[]>([emptyTurnover()]);

  const [hasGst, setHasGst] = useState(false);
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

  // Restore any locally-saved draft once, on the client, THEN reveal the form.
  useEffect(() => {
    let draft: {
      form?: Partial<FormState>;
      hasGst?: boolean;
      offersService?: boolean;
      offersProduct?: boolean;
      serviceActivitiesArr?: string[];
      otherServiceDetails?: string;
      oemOrDealer?: string;
      products?: ProductRow[];
      experiences?: ExperienceRow[];
      purchaseOrders?: POrow[];
      turnovers?: TurnoverRow[];
    } | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) draft = JSON.parse(raw);
    } catch {
      /* ignore unreadable / unavailable storage */
    }
    /* eslint-disable react-hooks/set-state-in-effect -- one-time client hydration + reveal */
    if (draft?.form) setForm((f) => ({ ...f, ...draft!.form }));
    setHasGst(draft?.hasGst ?? Boolean(draft?.form?.gstNo));
    if (draft?.offersService !== undefined) setOffersService(draft.offersService);
    if (draft?.offersProduct !== undefined) setOffersProduct(draft.offersProduct);
    if (Array.isArray(draft?.serviceActivitiesArr)) setServiceActivities(new Set(draft.serviceActivitiesArr));
    if (draft?.otherServiceDetails !== undefined) setOtherServiceDetails(draft.otherServiceDetails);
    if (draft?.oemOrDealer !== undefined) setOemOrDealer(draft.oemOrDealer);
    if (Array.isArray(draft?.products) && draft.products.length) setProducts(draft.products);
    if (Array.isArray(draft?.experiences) && draft.experiences.length) setExperiences(draft.experiences);
    if (Array.isArray(draft?.purchaseOrders) && draft.purchaseOrders.length) setPurchaseOrders(draft.purchaseOrders);
    if (Array.isArray(draft?.turnovers) && draft.turnovers.length) setTurnovers(draft.turnovers);
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
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          form,
          hasGst,
          offersService,
          offersProduct,
          serviceActivitiesArr: [...serviceActivities],
          otherServiceDetails,
          oemOrDealer,
          products,
          experiences,
          purchaseOrders,
          turnovers,
        })
      );
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, [
    form,
    hasGst,
    offersService,
    offersProduct,
    serviceActivities,
    otherServiceDetails,
    oemOrDealer,
    products,
    experiences,
    purchaseOrders,
    turnovers,
    done,
    storageKey,
  ]);

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
    // Company step: at least one category must be selected.
    if (step === 0 && !offersService && !offersProduct) {
      setStepError(true);
      return;
    }
    // Offerings step: OEM/Dealer required when product vendor.
    if (step === OFFERINGS_STEP && offersProduct && !oemOrDealer) {
      setStepError(true);
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
    // Category check
    if (!offersService && !offersProduct) {
      setStepError(true);
      if (step !== 0) {
        setStep(0);
        setMaxStep((m) => Math.max(m, 0));
      }
      return;
    }
    // OEM/Dealer check
    if (offersProduct && !oemOrDealer) {
      setStepError(true);
      if (step !== OFFERINGS_STEP) {
        setStep(OFFERINGS_STEP);
        setMaxStep((m) => Math.max(m, OFFERINGS_STEP));
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

  // Route a server-side validation rejection back to the correct field/step.
  function applyServerIssues(issues: { field: string; message: string }[]) {
    // Non-FormState fields mapped to their step index.
    const EXTRA_FIELD_STEP: Record<string, number> = {
      offersService: 0,
      offersProduct: 0,
      oemOrDealer: OFFERINGS_STEP,
      serviceActivities: OFFERINGS_STEP,
      panNo: STATUTORY_STEP,
    };

    const mapped: Partial<Record<FieldName, string>> = {};
    for (const it of issues) {
      if (it.field in EMPTY_FORM) mapped[it.field as FieldName] = it.message;
    }
    if (!Object.keys(mapped).length) {
      // Try routing via extra-field map before falling back to a banner.
      const firstExtra = issues.find((it) => it.field in EXTRA_FIELD_STEP);
      if (firstExtra) {
        const targetStep = EXTRA_FIELD_STEP[firstExtra.field];
        setSubmitError(firstExtra.message);
        setShowReview(false);
        setStepError(true);
        if (targetStep !== step) setStep(targetStep);
        return;
      }
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

      // Category / offerings
      fd.set("offersService", String(offersService));
      fd.set("offersProduct", String(offersProduct));
      if (oemOrDealer) fd.set("oemOrDealer", oemOrDealer);
      if (otherServiceDetails.trim()) fd.set("otherServiceDetails", otherServiceDetails.trim());

      // Service activities as {category, item} rows
      fd.set(
        "serviceActivities",
        JSON.stringify(
          [...serviceActivities].map((a) => ({
            category: a,
            item: a === "Other" ? otherServiceDetails : "",
          }))
        )
      );

      // Products, experiences, purchase orders, turnovers
      fd.set("products", JSON.stringify(products.filter((p) => p.name.trim())));
      fd.set(
        "experiences",
        JSON.stringify(
          experiences.filter((e) => e.financialYear.trim() && e.clientProject.trim())
        )
      );
      fd.set(
        "purchaseOrders",
        JSON.stringify(
          purchaseOrders.filter((p) => p.poNumber || p.client || p.value || p.poDate)
        )
      );
      fd.set(
        "turnovers",
        JSON.stringify(turnovers.filter((t) => t.financialYear.trim() && t.amount.trim()))
      );

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
    const isValid = Boolean(VALIDATORS[name] && touched[name] && !errors[name] && form[name].trim());
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
        <div className="relative">
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
            className={cn(
              hasErr
                ? "border-rose-300 focus:border-rose-300 focus:ring-rose-200/60"
                : isValid
                  ? "border-emerald-300"
                  : undefined,
              isValid && opts.type !== "date" ? "pr-10" : undefined
            )}
          />
          {isValid && opts.type !== "date" && (
            <Check className="animate-tick pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
          )}
        </div>
      </UIField>
    );
  }

  // Row updaters (mirror updateService pattern for each repeatable group).
  function updateProduct(i: number, key: keyof ProductRow, value: string) {
    setProducts((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }
  function updateExperience(i: number, key: keyof ExperienceRow, value: string) {
    setExperiences((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }
  function updatePO(i: number, key: keyof POrow, value: string) {
    setPurchaseOrders((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }
  function updateTurnover(i: number, key: keyof TurnoverRow, value: string) {
    setTurnovers((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }

  // ── Content per state ──────────────────────────────────────────────────────

  const isCard = !ready || Boolean(terminal) || done;
  let content: React.ReactNode;

  if (!ready) {
    content = (
      <div className="w-full space-y-4">
        <div className={cn("bg-white rounded-2xl shadow-[var(--shadow-card)] p-6")}>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>
        <p className="text-center text-sm text-slate-400">Loading your registration form…</p>
      </div>
    );
  } else if (terminal) {
    content = (
      <div
        role="alert"
        className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white p-10 text-center shadow-[var(--shadow-pop)]"
      >
        <Blob className="-top-16 -right-12 h-44 w-44" color="rgba(245,158,11,0.16)" />
        <div className="relative mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-200/70">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h1
          ref={terminalRef}
          tabIndex={-1}
          className="font-display relative text-2xl font-extrabold tracking-[-0.02em] text-slate-900 outline-none"
        >
          {terminal.title}
        </h1>
        <p className="relative mt-2 text-sm text-slate-600">{terminal.body}</p>
      </div>
    );
  } else if (done) {
    content = (
      <div
        role="status"
        aria-live="polite"
        className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white p-10 text-center shadow-[var(--shadow-pop)]"
      >
        <Blob className="-top-16 left-1/2 h-48 w-48 -translate-x-1/2" color="rgba(20,184,166,0.18)" />
        <SuccessCheck className="relative mx-auto mb-2" confetti />
        <h1
          ref={successRef}
          tabIndex={-1}
          className="font-display relative text-2xl font-extrabold tracking-[-0.02em] text-slate-900 outline-none"
        >
          Registration submitted
        </h1>
        <p className="relative mt-2 text-sm text-slate-600">
          Thank you. We&apos;ve received your details and emailed you a confirmation. Our procurement team
          will review and get in touch. This registration link is now closed.
        </p>
        {docWarnings && (
          <div className="relative mx-auto mt-5 max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-700">
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
    const categoryMissing = step === 0 && stepError && !offersService && !offersProduct;
    const oemMissing = step === OFFERINGS_STEP && stepError && offersProduct && !oemOrDealer;
    const showStepBanner =
      stepError && (visibleFieldErrors.length > 0 || visibleFileError || categoryMissing || oemMissing);

    content = (
      <>
        <form ref={formRef} onSubmit={(e) => e.preventDefault()} noValidate className="space-y-6">
          {showStepBanner && (
            <div
              role="alert"
              className="animate-fade-up flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
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
                {tf("mobileNumber", {
                  required: true,
                  type: "tel",
                  inputMode: "tel",
                  hint: "10-digit Indian mobile",
                  placeholder: "98765 43210",
                })}
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
                {tf("country")}
                {tf("pinCode", { hint: "6 digits", inputMode: "tel", placeholder: "400001" })}
                {tf("website", { type: "url", inputMode: "url", placeholder: "https://" })}
                {tf("dateOfIncorporation", { type: "date" })}
                {tf("yearsOfService")}
                {tf("annualTurnover")}
              </div>

              {/* Category selection */}
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-4">
                <p className="mb-3 text-sm font-medium text-slate-700">
                  What does your company offer?{" "}
                  <span className="text-rose-500" aria-hidden="true">
                    *
                  </span>
                </p>
                <div className="flex flex-wrap gap-x-8 gap-y-3">
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={offersService}
                      onChange={(e) => {
                        setOffersService(e.target.checked);
                        setStepError(false);
                      }}
                      className="h-4 w-4 rounded border-slate-300 accent-brand"
                    />
                    Services (EPC, I&amp;C, BOS, etc.)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={offersProduct}
                      onChange={(e) => {
                        setOffersProduct(e.target.checked);
                        setStepError(false);
                      }}
                      className="h-4 w-4 rounded border-slate-300 accent-brand"
                    />
                    Products / Equipment
                  </label>
                </div>
                {categoryMissing && (
                  <p className="mt-2 text-sm text-rose-600">Please select at least one category.</p>
                )}
              </div>
            </Section>
          </div>

          {/* Step 1 — Offerings */}
          <div className={step === 1 ? "block animate-step-in" : "hidden"}>
            <Section title="Offerings" description={STEPS[1].description} icon={STEPS[1].icon}>
              {!offersService && !offersProduct ? (
                <p className="text-sm italic text-slate-400">
                  Go back to Company and select at least one category.
                </p>
              ) : (
                <div className="space-y-8">
                  {/* Service activities */}
                  {offersService && (
                    <div>
                      <p className="mb-3 text-sm font-semibold text-slate-700">Service Activities</p>
                      <div className="space-y-2.5">
                        {SERVICE_ACTIVITIES.map((act) => (
                          <label key={act} className="flex cursor-pointer items-center gap-3">
                            <input
                              type="checkbox"
                              checked={serviceActivities.has(act)}
                              onChange={(e) => {
                                setServiceActivities((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(act);
                                  else next.delete(act);
                                  return next;
                                });
                              }}
                              className="h-4 w-4 rounded border-slate-300 accent-brand"
                            />
                            <span className="text-sm text-slate-700">{act}</span>
                          </label>
                        ))}
                      </div>
                      {serviceActivities.has("Other") && (
                        <UIField label="Other service details" className="mt-4">
                          <Textarea
                            value={otherServiceDetails}
                            rows={2}
                            maxLength={MAX_LEN.text}
                            placeholder="Describe your other services…"
                            onChange={(e) => setOtherServiceDetails(e.target.value)}
                          />
                        </UIField>
                      )}
                    </div>
                  )}

                  {/* Product vendor section */}
                  {offersProduct && (
                    <div>
                      <p className="mb-3 text-sm font-semibold text-slate-700">
                        OEM or Dealer?{" "}
                        <span className="text-rose-500" aria-hidden="true">
                          *
                        </span>
                      </p>
                      <div className="mb-4 flex gap-6">
                        {OEM_DEALER.map((od) => (
                          <label key={od} className="flex cursor-pointer items-center gap-2.5">
                            <input
                              type="radio"
                              name="oemOrDealerDisplay"
                              value={od}
                              checked={oemOrDealer === od}
                              onChange={() => {
                                setOemOrDealer(od);
                                setStepError(false);
                              }}
                              className="h-4 w-4 border-slate-300 accent-brand"
                            />
                            <span className="text-sm font-medium text-slate-700">{od}</span>
                          </label>
                        ))}
                      </div>
                      {oemMissing && (
                        <p className="mb-3 text-sm text-rose-600">Please select OEM or Dealer.</p>
                      )}

                      {/* Product repeatable rows */}
                      <p className="mb-3 text-sm font-semibold text-slate-700">Products / Equipment</p>
                      <div className="space-y-4">
                        {products.map((row, i) => (
                          <div
                            key={i}
                            className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4"
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                                <span className="nums grid h-6 w-6 place-items-center rounded-md bg-brand-50 text-xs font-bold text-brand-700">
                                  {i + 1}
                                </span>
                                Product {i + 1}
                              </span>
                              {products.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setProducts((r) => r.filter((_, idx) => idx !== i))
                                  }
                                  className="press inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                  aria-label="Remove product"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Remove
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <UIField label="Product / Category">
                                <Input
                                  value={row.name}
                                  maxLength={MAX_LEN.text}
                                  placeholder="e.g. Solar Module"
                                  onChange={(e) => updateProduct(i, "name", e.target.value)}
                                />
                              </UIField>
                              <UIField label="Make / Brand">
                                <Input
                                  value={row.brand}
                                  maxLength={MAX_LEN.text}
                                  placeholder="e.g. Waaree"
                                  onChange={(e) => updateProduct(i, "brand", e.target.value)}
                                />
                              </UIField>
                              <UIField label="Model">
                                <Input
                                  value={row.model}
                                  maxLength={MAX_LEN.text}
                                  placeholder="e.g. WS-400"
                                  onChange={(e) => updateProduct(i, "model", e.target.value)}
                                />
                              </UIField>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setProducts((r) => [...r, emptyProduct()])}
                        className="press mt-4 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:border-brand hover:bg-brand-50/40"
                      >
                        <Plus className="h-4 w-4" />
                        Add product
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Section>
          </div>

          {/* Step 2 — Track record */}
          <div className={step === 2 ? "block animate-step-in" : "hidden"}>
            {/* Project Experience */}
            <Section
              title="Project Experience"
              description="Past projects and client engagements."
              icon={STEPS[2].icon}
            >
              <div className="space-y-4">
                {experiences.map((row, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <span className="nums grid h-6 w-6 place-items-center rounded-md bg-brand-50 text-xs font-bold text-brand-700">
                          {i + 1}
                        </span>
                        Experience {i + 1}
                      </span>
                      {experiences.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setExperiences((r) => r.filter((_, idx) => idx !== i))}
                          className="press inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Remove experience"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <UIField label="Financial Year">
                        <Input
                          value={row.financialYear}
                          maxLength={MAX_LEN.text}
                          placeholder="FY2023-24"
                          onChange={(e) => updateExperience(i, "financialYear", e.target.value)}
                        />
                      </UIField>
                      <UIField label="Client / Project">
                        <Input
                          value={row.clientProject}
                          maxLength={MAX_LEN.text}
                          onChange={(e) => updateExperience(i, "clientProject", e.target.value)}
                        />
                      </UIField>
                      <UIField label="Scope">
                        <Input
                          value={row.scope}
                          maxLength={MAX_LEN.text}
                          onChange={(e) => updateExperience(i, "scope", e.target.value)}
                        />
                      </UIField>
                      <UIField label="Value (₹)">
                        <Input
                          value={row.value}
                          maxLength={MAX_LEN.text}
                          onChange={(e) => updateExperience(i, "value", e.target.value)}
                        />
                      </UIField>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setExperiences((r) => [...r, emptyExperience()])}
                className="press mt-4 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:border-brand hover:bg-brand-50/40"
              >
                <Plus className="h-4 w-4" />
                Add experience
              </button>
            </Section>

            {/* Purchase Orders */}
            <Section
              title="Purchase Orders"
              description="Key purchase orders as evidence of track record."
              icon={STEPS[2].icon}
            >
              <div className="space-y-4">
                {purchaseOrders.map((row, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <span className="nums grid h-6 w-6 place-items-center rounded-md bg-brand-50 text-xs font-bold text-brand-700">
                          {i + 1}
                        </span>
                        PO {i + 1}
                      </span>
                      {purchaseOrders.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setPurchaseOrders((r) => r.filter((_, idx) => idx !== i))}
                          className="press inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Remove purchase order"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <UIField label="PO Number">
                        <Input
                          value={row.poNumber}
                          maxLength={MAX_LEN.text}
                          onChange={(e) => updatePO(i, "poNumber", e.target.value)}
                        />
                      </UIField>
                      <UIField label="Client">
                        <Input
                          value={row.client}
                          maxLength={MAX_LEN.text}
                          onChange={(e) => updatePO(i, "client", e.target.value)}
                        />
                      </UIField>
                      <UIField label="Value (₹)">
                        <Input
                          value={row.value}
                          maxLength={MAX_LEN.text}
                          onChange={(e) => updatePO(i, "value", e.target.value)}
                        />
                      </UIField>
                      <UIField label="PO Date">
                        <Input
                          type="date"
                          value={row.poDate}
                          onChange={(e) => updatePO(i, "poDate", e.target.value)}
                        />
                      </UIField>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPurchaseOrders((r) => [...r, emptyPO()])}
                className="press mt-4 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:border-brand hover:bg-brand-50/40"
              >
                <Plus className="h-4 w-4" />
                Add PO
              </button>
            </Section>

            {/* Annual Turnover */}
            <Section
              title="Annual Turnover"
              description="Last 3 financial years recommended."
              icon={STEPS[2].icon}
            >
              <div className="space-y-4">
                {turnovers.map((row, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <span className="nums grid h-6 w-6 place-items-center rounded-md bg-brand-50 text-xs font-bold text-brand-700">
                          {i + 1}
                        </span>
                        Year {i + 1}
                      </span>
                      {turnovers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setTurnovers((r) => r.filter((_, idx) => idx !== i))}
                          className="press inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Remove turnover year"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <UIField label="Financial Year">
                        <Input
                          value={row.financialYear}
                          maxLength={MAX_LEN.text}
                          placeholder="FY2023-24"
                          onChange={(e) => updateTurnover(i, "financialYear", e.target.value)}
                        />
                      </UIField>
                      <UIField label="Amount (₹)">
                        <Input
                          value={row.amount}
                          maxLength={MAX_LEN.text}
                          onChange={(e) => updateTurnover(i, "amount", e.target.value)}
                        />
                      </UIField>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setTurnovers((r) => [...r, emptyTurnover()])}
                className="press mt-4 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:border-brand hover:bg-brand-50/40"
              >
                <Plus className="h-4 w-4" />
                Add year
              </button>
            </Section>
          </div>

          {/* Step 3 — Statutory & Tax */}
          <div className={step === 3 ? "block animate-step-in" : "hidden"}>
            <Section
              title="Statutory & Tax Registration"
              description={STEPS[3].description}
              icon={STEPS[3].icon}
            >
              <div className="mb-5 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                <span className="text-sm font-medium text-slate-600">Optional:</span>
                <Toggle
                  label="GST registration"
                  checked={hasGst}
                  onChange={(v) => {
                    setHasGst(v);
                    if (!v) setField("gstNo", "");
                  }}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {hasGst && tf("gstNo", { hint: "15 characters", placeholder: "22AAAAA0000A1Z5" })}
                {tf("panNo", { required: true, hint: "10 characters", placeholder: "ABCDE1234F" })}
                {tf("msmeNo", { hint: "if applicable" })}
              </div>
            </Section>
          </div>

          {/* Step 4 — Bank */}
          <div className={step === 4 ? "block animate-step-in" : "hidden"}>
            <Section title="Bank Details" description={STEPS[4].description} icon={STEPS[4].icon}>
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

          {/* Step 5 — Documents */}
          <div className={step === 5 ? "block animate-step-in" : "hidden"}>
            <Section title="Documents" description={STEPS[5].description} icon={STEPS[5].icon}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {DOC_FIELDS.map((d) => (
                  <Dropzone
                    key={d.name}
                    name={d.name}
                    label={d.label}
                    hint={d.hint}
                    multiple={d.multiple}
                    error={fileErrors[d.name]}
                    onFiles={(files) => onFilesSelected(d.name, files)}
                  />
                ))}
              </div>
            </Section>
          </div>
        </form>

        {/* Sticky action bar */}
        <div
          className="glass sticky bottom-0 z-10 mt-6 flex items-center justify-between gap-3 rounded-t-2xl border-t border-slate-200/70 py-3 px-1"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div>
            {step > 0 && (
              <button type="button" onClick={goBack} className={cn(btn("secondary", "md"), "rounded-full")}>
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
              <Button type="button" onClick={goNext} size="lg" className="rounded-full px-7">
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={openReview} variant="primary" size="lg" className="rounded-full px-7">
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
          offersService={offersService}
          offersProduct={offersProduct}
          oemOrDealer={oemOrDealer}
          serviceActivities={serviceActivities}
          otherServiceDetails={otherServiceDetails}
          products={products}
          experiences={experiences}
          purchaseOrders={purchaseOrders}
          turnovers={turnovers}
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
    <aside className="relative isolate sticky top-0 hidden h-dvh flex-col gap-9 overflow-hidden bg-gradient-to-b from-brand-600 via-brand-700 to-brand-900 px-8 py-10 text-white lg:flex xl:px-10">
      <SunGlow className="-top-16 -right-12 h-56 w-56" animate />
      <Atmosphere dots grain />

      <div className="relative z-10 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 font-extrabold tracking-tight ring-1 ring-inset ring-white/25 backdrop-blur">
          GNE
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">Vendor Registration</p>
          <p className="text-xs text-white/75">GNE Solar EPC · Supplier onboarding</p>
        </div>
      </div>

      <ol className="relative z-10 space-y-1">
        {STEPS.map((s, i) => {
          const state = complete || i < step ? "done" : i === step ? "current" : "todo";
          const clickable = !complete && i <= maxStep;
          const isLast = i === STEPS.length - 1;
          return (
            <li key={s.id} className="relative">
              {!isLast && (
                <span
                  aria-hidden="true"
                  className="absolute left-[1.65rem] top-[2.4rem] h-[calc(100%-1.4rem)] w-0.5 -translate-x-1/2 rounded-full transition-colors"
                  style={{
                    background: state === "done" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.18)",
                  }}
                />
              )}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStep(i)}
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "relative flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  clickable ? "cursor-pointer hover:bg-white/10" : "cursor-default"
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-all nums",
                    state === "done"
                      ? "bg-white text-brand-700 shadow-sm"
                      : state === "current"
                        ? "scale-110 bg-white/15 text-white ring-2 ring-white"
                        : "bg-white/10 text-white/70"
                  )}
                >
                  {state === "done" ? <Check className="animate-tick h-4 w-4" /> : i + 1}
                </span>
                <span className="min-w-0 pt-0.5">
                  <span
                    className={cn(
                      "block text-sm font-medium",
                      state === "todo" ? "text-white/70" : "text-white"
                    )}
                  >
                    {s.title}
                  </span>
                  <span className="block text-xs text-white/65">{s.short}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="relative z-10 mt-auto space-y-5">
        <div>
          <div className="flex items-center justify-between text-xs text-white/80">
            <span>Progress</span>
            <span className="nums">{complete ? "Complete" : `Step ${step + 1} of ${STEPS.length}`}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-white transition-all duration-500 motion-reduce:transition-none"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="space-y-2 text-xs text-white/80">
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
  return (
    <header className="relative isolate overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 px-4 pt-9 pb-6 text-white lg:hidden">
      <SunGlow className="-top-12 -right-8 h-36 w-36" />
      <Atmosphere dots grain />
      <div className="relative z-10 flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 text-xs font-extrabold tracking-tight ring-1 ring-inset ring-white/25">
          GNE
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Vendor Registration</p>
          <p className="nums text-xs text-white/90">
            {complete ? "Complete" : `${STEPS[step].title} · Step ${step + 1} of ${STEPS.length}`}
          </p>
        </div>
      </div>
      <div className="relative z-10 mt-3 flex gap-1.5">
        {STEPS.map((s, i) => (
          <span
            key={s.id}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              complete || i < step ? "bg-white" : i === step ? "bg-accent-300" : "bg-white/30"
            )}
          />
        ))}
      </div>
      <Wave className="absolute inset-x-0 bottom-[-1px]" />
    </header>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-2.5 rounded-lg text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2",
        checked ? "text-slate-800" : "text-slate-500"
      )}
    >
      <span
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-brand" : "bg-slate-300"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </span>
      {label}
    </button>
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
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-b from-brand-50 to-brand-100 text-brand-700 ring-1 ring-brand-200/60">
              {icon}
            </span>
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
  offersService,
  offersProduct,
  oemOrDealer,
  serviceActivities,
  otherServiceDetails,
  products,
  experiences,
  purchaseOrders,
  turnovers,
  fileNames,
  submitting,
  submitError,
  onEdit,
  onClose,
  onConfirm,
}: {
  form: FormState;
  offersService: boolean;
  offersProduct: boolean;
  oemOrDealer: string;
  serviceActivities: Set<string>;
  otherServiceDetails: string;
  products: ProductRow[];
  experiences: ExperienceRow[];
  purchaseOrders: POrow[];
  turnovers: TurnoverRow[];
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

  const filledProducts = products.filter((p) => p.name.trim());
  const filledExperiences = experiences.filter((e) => e.financialYear.trim() || e.clientProject.trim());
  const filledPOs = purchaseOrders.filter((p) => p.poNumber || p.client || p.value || p.poDate);
  const filledTurnovers = turnovers.filter((t) => t.financialYear.trim() && t.amount.trim());
  const uploadedDocs = DOC_FIELDS.map((d) => ({
    label: d.label,
    names: fileNames[d.name] ?? [],
  })).filter((d) => d.names.length > 0);

  return createPortal(
    <div className="animate-overlay-in fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        className="animate-sheet-up w-full max-w-2xl rounded-t-3xl border border-slate-200 bg-white shadow-xl outline-none sm:my-8 sm:animate-modal-in sm:rounded-2xl"
      >
        {/* mobile grab handle */}
        <div className="flex justify-center pt-2.5 sm:hidden">
          <span className="h-1.5 w-10 rounded-full bg-slate-300" />
        </div>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2
              id="review-title"
              className="font-display text-lg font-extrabold tracking-[-0.01em] text-slate-900"
            >
              Review your details
            </h2>
            <p className="text-xs text-slate-500">Please check everything is correct before submitting.</p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="press grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60dvh] overflow-y-auto px-5 py-4">
          {/* Company */}
          <ReviewBlock title="Company Information" onEdit={() => onEdit(0)}>
            {(() => {
              const rows = rowsFrom(STEPS[0].fields);
              return rows.length ? (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  {rows.map((r) => (
                    <div
                      key={r.label}
                      className="flex justify-between gap-3 border-b border-slate-50 py-1 text-sm"
                    >
                      <dt className="text-slate-500">{r.label}</dt>
                      <dd className="break-words text-right font-medium text-slate-800">{r.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm italic text-slate-400">Nothing entered.</p>
              );
            })()}
            <div className="mt-2 text-sm text-slate-600">
              <span className="font-medium">Category: </span>
              {[offersService && "Services", offersProduct && "Products"].filter(Boolean).join(", ") ||
                "None selected"}
            </div>
          </ReviewBlock>

          {/* Offerings */}
          <ReviewBlock title="Offerings" onEdit={() => onEdit(1)}>
            {offersService && serviceActivities.size > 0 && (
              <div className="mb-2 text-sm text-slate-700">
                <span className="font-medium text-slate-800">Service activities: </span>
                {[...serviceActivities].join(", ")}
                {serviceActivities.has("Other") && otherServiceDetails.trim() && (
                  <span className="text-slate-500"> — {otherServiceDetails.trim()}</span>
                )}
              </div>
            )}
            {offersProduct && (
              <>
                {oemOrDealer && (
                  <div className="mb-2 text-sm text-slate-700">
                    <span className="font-medium text-slate-800">Type: </span>
                    {oemOrDealer}
                  </div>
                )}
                {filledProducts.length > 0 && (
                  <ul className="space-y-1">
                    {filledProducts.map((p, i) => (
                      <li key={i} className="text-sm text-slate-700">
                        <span className="font-medium text-slate-800">{p.name}</span>
                        {p.brand && <span className="text-slate-500"> · {p.brand}</span>}
                        {p.model && <span className="text-slate-500"> · {p.model}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {!offersService && !offersProduct && (
              <p className="text-sm italic text-slate-400">No category selected.</p>
            )}
          </ReviewBlock>

          {/* Track record */}
          <ReviewBlock title="Track Record" onEdit={() => onEdit(2)}>
            {filledExperiences.length > 0 && (
              <div className="mb-2">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Experience
                </p>
                <ul className="space-y-1">
                  {filledExperiences.map((e, i) => (
                    <li key={i} className="text-sm text-slate-700">
                      <span className="font-medium text-slate-800">{e.clientProject}</span>
                      {e.financialYear && (
                        <span className="text-slate-500"> ({e.financialYear})</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {filledTurnovers.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Turnover
                </p>
                <ul className="space-y-1">
                  {filledTurnovers.map((t, i) => (
                    <li key={i} className="text-sm text-slate-700">
                      <span className="font-medium text-slate-800">{t.financialYear}</span>
                      <span className="text-slate-500"> — ₹{t.amount}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {filledPOs.length > 0 && (
              <div className="mb-2">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Purchase Orders
                </p>
                <ul className="space-y-1">
                  {filledPOs.map((p, i) => (
                    <li key={i} className="text-sm text-slate-700">
                      <span className="font-medium text-slate-800">{p.poNumber || "—"}</span>
                      {p.client && <span className="text-slate-500"> · {p.client}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {filledExperiences.length === 0 && filledPOs.length === 0 && filledTurnovers.length === 0 && (
              <p className="text-sm italic text-slate-400">Nothing entered.</p>
            )}
          </ReviewBlock>

          {/* Statutory */}
          <ReviewBlock title="Statutory & Tax" onEdit={() => onEdit(3)}>
            {(() => {
              const rows = rowsFrom(STEPS[3].fields);
              return rows.length ? (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  {rows.map((r) => (
                    <div
                      key={r.label}
                      className="flex justify-between gap-3 border-b border-slate-50 py-1 text-sm"
                    >
                      <dt className="text-slate-500">{r.label}</dt>
                      <dd className="break-words text-right font-medium text-slate-800">{r.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm italic text-slate-400">Nothing entered.</p>
              );
            })()}
          </ReviewBlock>

          {/* Bank */}
          <ReviewBlock title="Bank Details" onEdit={() => onEdit(4)}>
            {(() => {
              const rows = rowsFrom(STEPS[4].fields);
              return rows.length ? (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  {rows.map((r) => (
                    <div
                      key={r.label}
                      className="flex justify-between gap-3 border-b border-slate-50 py-1 text-sm"
                    >
                      <dt className="text-slate-500">{r.label}</dt>
                      <dd className="break-words text-right font-medium text-slate-800">{r.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm italic text-slate-400">Nothing entered.</p>
              );
            })()}
          </ReviewBlock>

          {/* Documents */}
          <ReviewBlock title="Documents" onEdit={() => onEdit(5)}>
            {uploadedDocs.length ? (
              <ul className="space-y-1 text-sm text-slate-700">
                {uploadedDocs.map((d) => (
                  <li key={d.label} className="flex justify-between gap-3">
                    <span className="text-slate-500">{d.label}</span>
                    <span className="break-words text-right font-medium text-slate-800">
                      {d.names.join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm italic text-slate-400">No files attached.</p>
            )}
          </ReviewBlock>
        </div>

        <div
          className="border-t border-slate-100 px-5 py-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {submitError && (
            <div
              role="alert"
              className="animate-fade-up mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}
          <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">By submitting, you confirm the details above are accurate.</p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className={cn(btn("secondary", "md"), "rounded-full")}
              >
                Back to form
              </button>
              <Button
                type="button"
                onClick={onConfirm}
                disabled={submitting}
                className="rounded-full px-6"
              >
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
          className="press inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
      </div>
      {children}
    </section>
  );
}
