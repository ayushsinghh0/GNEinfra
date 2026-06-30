"use client";
import { useState, FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "@/components/ui";
import { EMP_CATEGORIES } from "@/lib/hr-validation";
import { AlertCircle } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";

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

export default function EmployeeForm({ id, initial }: { id?: string; initial?: Values }) {
  const router = useRouter();
  const [v, setV] = useState<Values>({ ...EMPTY, ...(initial ?? {}) });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

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

  // Confirm before creating; edits save directly.
  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!id) { setConfirmOpen(true); return; }
    doSave();
  }

  const Txt = (k: string, label: string, req = false, type = "text") => (
    <Field label={label} required={req} htmlFor={k}>
      <Input id={k} type={type} value={v[k]} onChange={set(k)} />
    </Field>
  );

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
          <Select id="empCategory" value={v.empCategory} onChange={set("empCategory")}>
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
        {Txt("totalCtc", "Total CTC (₹)")}
        {Txt("salary", "Salary (₹)")}
        {Txt("lta", "LTA (₹)")}
        {Txt("specialAllowance", "Special Allowance (₹)")}
        {Txt("conveyance", "Conveyance (₹)")}
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
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
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
    </form>
  );
}
