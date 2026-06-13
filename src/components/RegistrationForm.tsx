"use client";

import { useState, FormEvent } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Field as UIField,
  Input,
  Textarea,
  Select,
  Button,
} from "@/components/ui";
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
} from "lucide-react";

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

// Small presentational helpers ------------------------------------------------

function Field({
  label,
  name,
  required,
  type = "text",
  hint,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  hint?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <UIField label={label} required={required} hint={hint}>
      <Input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
      />
    </UIField>
  );
}

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
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700">
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

function FileField({
  label,
  name,
  hint,
  multiple,
}: {
  label: string;
  name: string;
  hint?: string;
  multiple?: boolean;
}) {
  return (
    <label className="group block cursor-pointer rounded-lg border border-dashed border-slate-300 bg-slate-50/50 px-4 py-3 transition-colors hover:border-brand hover:bg-brand-50/40">
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
        className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
      />
    </label>
  );
}

export default function RegistrationForm({
  token,
  defaultEmail,
  defaultCompany,
}: {
  token: string;
  defaultEmail?: string;
  defaultCompany?: string;
}) {
  const [projects, setProjects] = useState<ProjectRow[]>([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function updateRow(i: number, key: keyof ProjectRow, value: string) {
    setProjects((rows) =>
      rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r))
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("token", token);
      // Only include project rows the vendor actually filled in.
      const filled = projects.filter((p) =>
        Object.values(p).some((v) => v.trim() !== "")
      );
      fd.set(
        "projects",
        JSON.stringify(filled.map((p, i) => ({ ...p, serialNo: i + 1 })))
      );

      const res = await fetch("/api/register", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Submission failed. Please try again.");
      }
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-10 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Registration submitted
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Thank you. We&apos;ve received your details and emailed you a
          confirmation. Our procurement team will review and get in touch.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Section
        title="Company Information"
        description="Tell us who you are and how to reach you."
        icon={<Building2 className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Company Name" name="companyName" required defaultValue={defaultCompany} />
          <Field label="Contact Person" name="contactPerson" />
          <Field label="Mobile Number" name="mobileNumber" />
          <Field label="Email Address" name="email" type="email" required defaultValue={defaultEmail} />
          <UIField label="Address" className="md:col-span-2">
            <Textarea name="address" rows={2} />
          </UIField>
          <Field label="State" name="state" />
          <Field label="Website" name="website" placeholder="https://" />
          <Field label="Date of Incorporation" name="dateOfIncorporation" type="date" />
          <Field label="Years of Service" name="yearsOfService" />
          <Field label="Annual Turnover" name="annualTurnover" />
        </div>
      </Section>

      <Section
        title="Statutory & Tax Registration"
        description="Provide the registrations applicable to your business."
        icon={<ShieldCheck className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="GST No" name="gstNo" required hint="15 characters" placeholder="22AAAAA0000A1Z5" />
          <Field label="PAN No" name="panNo" required hint="10 characters" placeholder="ABCDE1234F" />
          <Field label="Excise No" name="exciseNo" hint="if applicable" />
          <Field label="TIN No" name="tinNo" hint="if applicable" />
          <Field label="VAT / LST No" name="vatLstNo" hint="if applicable" />
          <Field label="CST No" name="cstNo" hint="if applicable" />
          <Field label="Service Tax No" name="serviceTaxNo" hint="if applicable" />
          <Field label="MSME No" name="msmeNo" hint="if applicable" />
        </div>
      </Section>

      <Section
        title="Bank Details"
        description="Used for payments and bank verification."
        icon={<Banknote className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Bank Name" name="bankName" />
          <Field label="Branch Address" name="bankBranchAddress" />
          <Field label="Bank Account No" name="bankAccountNo" />
          <Field label="Branch Code" name="bankBranchCode" />
          <Field label="IFSC Code" name="ifscCode" placeholder="HDFC0001234" />
          <Field label="SWIFT Code" name="swiftCode" hint="foreign vendors" />
          <Field label="IBAN Code" name="ibanCode" hint="foreign suppliers" />
        </div>
      </Section>

      <Section
        title="Past Projects"
        description="List solar/wind projects you have executed. Add as many rows as needed."
        icon={<Briefcase className="h-4 w-4" />}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-2">#</th>
                <th className="px-2 min-w-40">Client</th>
                <th className="px-2 min-w-28">Capacity</th>
                <th className="px-2 min-w-28">Type</th>
                <th className="px-2 min-w-28">EPC/I&amp;C/BOS</th>
                <th className="px-2 min-w-32">Location</th>
                <th className="px-2 min-w-24">Year</th>
                <th className="px-2 min-w-40">Scope</th>
                <th className="px-2 min-w-20">% Done</th>
                <th className="px-2 min-w-32">Remarks</th>
                <th className="px-2"></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((row, i) => (
                <tr key={i}>
                  <td className="px-2 text-slate-400">{i + 1}</td>
                  <td className="px-2">
                    <input className={cellCls} value={row.clientName} onChange={(e) => updateRow(i, "clientName", e.target.value)} />
                  </td>
                  <td className="px-2">
                    <input className={cellCls} value={row.capacity} onChange={(e) => updateRow(i, "capacity", e.target.value)} placeholder="MW" />
                  </td>
                  <td className="px-2">
                    <select className={cellCls} value={row.projectType} onChange={(e) => updateRow(i, "projectType", e.target.value)}>
                      <option value="">—</option>
                      <option>Solar</option>
                      <option>Wind</option>
                    </select>
                  </td>
                  <td className="px-2">
                    <select className={cellCls} value={row.contractType} onChange={(e) => updateRow(i, "contractType", e.target.value)}>
                      <option value="">—</option>
                      <option>EPC</option>
                      <option>I&amp;C</option>
                      <option>BOS</option>
                    </select>
                  </td>
                  <td className="px-2">
                    <input className={cellCls} value={row.location} onChange={(e) => updateRow(i, "location", e.target.value)} />
                  </td>
                  <td className="px-2">
                    <input className={cellCls} value={row.yearOfCompletion} onChange={(e) => updateRow(i, "yearOfCompletion", e.target.value)} />
                  </td>
                  <td className="px-2">
                    <input className={cellCls} value={row.scopeOfWork} onChange={(e) => updateRow(i, "scopeOfWork", e.target.value)} />
                  </td>
                  <td className="px-2">
                    <input className={cellCls} value={row.percentCompleted} onChange={(e) => updateRow(i, "percentCompleted", e.target.value)} />
                  </td>
                  <td className="px-2">
                    <input className={cellCls} value={row.remarks} onChange={(e) => updateRow(i, "remarks", e.target.value)} />
                  </td>
                  <td className="px-2">
                    {projects.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setProjects((r) => r.filter((_, idx) => idx !== i))}
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => setProjects((r) => [...r, emptyRow()])}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 transition-colors hover:text-brand"
        >
          <Plus className="h-4 w-4" />
          Add project
        </button>
      </Section>

      <Section
        title="Documents"
        description="A cancelled cheque copy is required for bank verification."
        icon={<FileText className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FileField label="Cancelled Cheque" name="cancelledCheque" hint="recommended" />
          <FileField label="GST Certificate" name="gstCertificate" />
          <FileField label="PAN Card" name="panCard" />
          <FileField label="Other Documents" name="otherDocs" multiple />
        </div>
      </Section>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        <p className="text-xs text-slate-400 sm:mr-auto">
          By submitting, you confirm the details above are accurate.
        </p>
        <Button type="submit" variant="primary" disabled={submitting} className="h-11 px-8 text-sm">
          {submitting ? "Submitting…" : "Submit Registration"}
        </Button>
      </div>
    </form>
  );
}
