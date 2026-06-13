"use client";

import { useState, FormEvent } from "react";

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
    <label className="block">
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-600"> *</span>}
        {hint && <span className="font-normal text-slate-400"> — {hint}</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
      />
    </label>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">{title}</h2>
      {children}
    </section>
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
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 text-3xl mb-4">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Registration submitted</h1>
        <p className="mt-3 text-slate-600">
          Thank you. We&apos;ve received your details and emailed you a
          confirmation. Our procurement team will review and get in touch.
        </p>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <Section title="Company Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Company Name" name="companyName" required defaultValue={defaultCompany} />
          <Field label="Contact Person" name="contactPerson" />
          <Field label="Mobile Number" name="mobileNumber" />
          <Field label="Email Address" name="email" type="email" required defaultValue={defaultEmail} />
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Address</span>
            <textarea
              name="address"
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </label>
          <Field label="State" name="state" />
          <Field label="Website" name="website" placeholder="https://" />
          <Field label="Date of Incorporation" name="dateOfIncorporation" type="date" />
          <Field label="Years of Service" name="yearsOfService" />
          <Field label="Annual Turnover" name="annualTurnover" />
        </div>
      </Section>

      <Section title="Statutory & Tax Registration">
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

      <Section title="Bank Details">
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

      <Section title="Past Projects">
        <p className="text-sm text-slate-500 mb-3">
          List solar/wind projects you have executed. Add as many rows as needed.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2">#</th>
                <th className="px-2 min-w-40">Client</th>
                <th className="px-2 min-w-28">Capacity</th>
                <th className="px-2 min-w-28">Type</th>
                <th className="px-2 min-w-28">EPC/I&C/BOS</th>
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
                    <input className={inputCls} value={row.clientName} onChange={(e) => updateRow(i, "clientName", e.target.value)} />
                  </td>
                  <td className="px-2">
                    <input className={inputCls} value={row.capacity} onChange={(e) => updateRow(i, "capacity", e.target.value)} placeholder="MW" />
                  </td>
                  <td className="px-2">
                    <select className={inputCls} value={row.projectType} onChange={(e) => updateRow(i, "projectType", e.target.value)}>
                      <option value="">—</option>
                      <option>Solar</option>
                      <option>Wind</option>
                    </select>
                  </td>
                  <td className="px-2">
                    <select className={inputCls} value={row.contractType} onChange={(e) => updateRow(i, "contractType", e.target.value)}>
                      <option value="">—</option>
                      <option>EPC</option>
                      <option>I&C</option>
                      <option>BOS</option>
                    </select>
                  </td>
                  <td className="px-2">
                    <input className={inputCls} value={row.location} onChange={(e) => updateRow(i, "location", e.target.value)} />
                  </td>
                  <td className="px-2">
                    <input className={inputCls} value={row.yearOfCompletion} onChange={(e) => updateRow(i, "yearOfCompletion", e.target.value)} />
                  </td>
                  <td className="px-2">
                    <input className={inputCls} value={row.scopeOfWork} onChange={(e) => updateRow(i, "scopeOfWork", e.target.value)} />
                  </td>
                  <td className="px-2">
                    <input className={inputCls} value={row.percentCompleted} onChange={(e) => updateRow(i, "percentCompleted", e.target.value)} />
                  </td>
                  <td className="px-2">
                    <input className={inputCls} value={row.remarks} onChange={(e) => updateRow(i, "remarks", e.target.value)} />
                  </td>
                  <td className="px-2">
                    {projects.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setProjects((r) => r.filter((_, idx) => idx !== i))}
                        className="text-rose-500 hover:text-rose-700 text-lg leading-none"
                        aria-label="Remove row"
                      >
                        ×
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
          className="mt-2 text-sm font-medium text-brand hover:underline"
        >
          + Add project
        </button>
      </Section>

      <Section title="Documents">
        <p className="text-sm text-slate-500 mb-4">
          Upload PDF or image files (max 10 MB each). A cancelled cheque copy is
          required for bank verification.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Cancelled Cheque <span className="font-normal text-slate-400">(recommended)</span></span>
            <input name="cancelledCheque" type="file" accept=".pdf,image/*" className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-white" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">GST Certificate</span>
            <input name="gstCertificate" type="file" accept=".pdf,image/*" className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-white" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">PAN Card</span>
            <input name="panCard" type="file" accept=".pdf,image/*" className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-white" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Other Documents</span>
            <input name="otherDocs" type="file" multiple accept=".pdf,image/*" className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-white" />
          </label>
        </div>
      </Section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="px-8 py-3 rounded-lg bg-brand text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit Registration"}
        </button>
      </div>
    </form>
  );
}
