"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui";

type Employee = { id: string; empId: string; name: string };

type Values = {
  employeeId: string;
  hasLaptop: boolean;
  laptopBag: boolean;
  mouse: boolean;
  charger: boolean;
  idCard: boolean;
  lpSerialNo: string;
  makeModel: string;
  lpCategory: string;
  oemName: string;
};

const EMPTY: Values = {
  employeeId: "",
  hasLaptop: false,
  laptopBag: false,
  mouse: false,
  charger: false,
  idCard: false,
  lpSerialNo: "",
  makeModel: "",
  lpCategory: "",
  oemName: "",
};

const CHECKBOXES: { key: keyof Values; label: string }[] = [
  { key: "hasLaptop", label: "Laptop" },
  { key: "laptopBag", label: "Laptop Bag" },
  { key: "mouse", label: "Mouse" },
  { key: "charger", label: "Charger" },
  { key: "idCard", label: "ID Card" },
];

export default function AssetForm({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const [v, setV] = useState<Values>({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function setStr(k: keyof Values) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setV((s) => ({ ...s, [k]: e.target.value }));
  }

  function setBool(k: keyof Values) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setV((s) => ({ ...s, [k]: e.target.checked }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/hr/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not save");
      setV({ ...EMPTY });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Employee" required htmlFor="employeeId">
          <Select id="employeeId" value={v.employeeId} onChange={setStr("employeeId")} required>
            <option value="">Select employee…</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.empId} — {emp.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="LP Serial No" htmlFor="lpSerialNo">
          <Input id="lpSerialNo" value={v.lpSerialNo} onChange={setStr("lpSerialNo")} />
        </Field>

        <Field label="Make / Model" htmlFor="makeModel">
          <Input id="makeModel" value={v.makeModel} onChange={setStr("makeModel")} />
        </Field>

        <Field label="LP Category" htmlFor="lpCategory">
          <Input id="lpCategory" value={v.lpCategory} onChange={setStr("lpCategory")} />
        </Field>

        <Field label="OEM Name" htmlFor="oemName">
          <Input id="oemName" value={v.oemName} onChange={setStr("oemName")} />
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-[13px] font-medium text-slate-700">Assets issued</legend>
        <div className="flex flex-wrap gap-4">
          {CHECKBOXES.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand accent-brand"
                checked={v[key] as boolean}
                onChange={setBool(key)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Add asset record"}
        </Button>
      </div>
    </form>
  );
}
