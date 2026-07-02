"use client";
import { useMemo, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui";
import { toast } from "@/components/Toast";

export type AssetEmployee = {
  id: string; empId: string; name: string;
  designation: string | null; mailId: string | null; location: string | null;
};

export type AssetValues = {
  employeeId: string;
  hasLaptop: boolean; laptopBag: boolean; mouse: boolean; charger: boolean; idCard: boolean;
  lpSerialNo: string; makeModel: string; lpCategory: string; oemName: string;
  returnedAt?: string;
};

const EMPTY: AssetValues = {
  employeeId: "",
  hasLaptop: false, laptopBag: false, mouse: false, charger: false, idCard: false,
  lpSerialNo: "", makeModel: "", lpCategory: "", oemName: "", returnedAt: "",
};

const CHECKBOXES: { key: keyof AssetValues; label: string }[] = [
  { key: "hasLaptop", label: "Laptop" },
  { key: "laptopBag", label: "Laptop Bag" },
  { key: "mouse", label: "Mouse" },
  { key: "charger", label: "Charger" },
  { key: "idCard", label: "ID Card" },
];

export default function AssetForm({
  employees,
  asset,
  assetId,
  onDone,
}: {
  employees: AssetEmployee[];
  asset?: AssetValues;
  assetId?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [v, setV] = useState<AssetValues>({ ...EMPTY, ...(asset ?? {}) });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => employees.find((e) => e.id === v.employeeId), [employees, v.employeeId]);

  const setStr = (k: keyof AssetValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));
  const setBool = (k: keyof AssetValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((s) => ({ ...s, [k]: e.target.checked }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const res = await fetch(assetId ? `/api/hr/assets/${assetId}` : "/api/hr/assets", {
        method: assetId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not save");
      toast(assetId ? "Changes saved" : "Asset added", "success");
      if (!assetId) setV({ ...EMPTY });
      router.refresh();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Employee" required htmlFor="employeeId">
          <Select id="employeeId" value={v.employeeId} onChange={setStr("employeeId")} required disabled={!!assetId}>
            <option value="">Select employee…</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.empId} — {emp.name}</option>
            ))}
          </Select>
        </Field>

        {/* Auto-filled from the linked employee (read-only) */}
        <Field label="Position" htmlFor="asset-position">
          <Input id="asset-position" value={selected?.designation ?? ""} readOnly disabled placeholder="—" />
        </Field>
        <Field label="Mail ID" htmlFor="asset-mail">
          <Input id="asset-mail" value={selected?.mailId ?? ""} readOnly disabled placeholder="—" />
        </Field>
        <Field label="Location" htmlFor="asset-location">
          <Input id="asset-location" value={selected?.location ?? ""} readOnly disabled placeholder="—" />
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

        {assetId && (
          <Field label="Returned On" htmlFor="returnedAt" hint="leave blank if still allocated">
            <Input id="returnedAt" type="date" value={v.returnedAt ?? ""} onChange={setStr("returnedAt")} />
          </Field>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-[13px] font-medium text-slate-700">Assets issued</legend>
        <div className="flex flex-wrap gap-4">
          {CHECKBOXES.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand accent-brand"
                checked={v[key] as boolean} onChange={setBool(key)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : assetId ? "Save changes" : "Add asset record"}
        </Button>
        {onDone && (
          <Button type="button" variant="secondary" disabled={busy} onClick={() => onDone()}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
