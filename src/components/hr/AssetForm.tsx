"use client";
import { useMemo, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui";
import { digitsOnly } from "@/components/finance/form-utils";
import { toast } from "@/components/Toast";
import { ASSET_TYPES, ASSET_CONDITIONS } from "@/lib/hr-validation";

export type AssetEmployee = {
  id: string; empId: string; name: string;
  designation: string | null; mailId: string | null; location: string | null;
};

export type AssetValues = {
  employeeId: string;
  hasLaptop: boolean; laptopBag: boolean; mouse: boolean; charger: boolean; idCard: boolean;
  assetType: string; lpSerialNo: string; makeModel: string; lpCategory: string; oemName: string;
  assetTag: string; condition: string; purchaseValue: string; purchaseDate: string;
  allocatedAt: string; remarks: string;
  returnedAt?: string;
};

const EMPTY: AssetValues = {
  employeeId: "",
  hasLaptop: false, laptopBag: false, mouse: false, charger: false, idCard: false,
  assetType: "", lpSerialNo: "", makeModel: "", lpCategory: "", oemName: "",
  assetTag: "", condition: "", purchaseValue: "", purchaseDate: "",
  allocatedAt: "", remarks: "", returnedAt: "",
};

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
  // The legacy accessory booleans (hasLaptop/laptopBag/…) stay in state so
  // editing an old record round-trips them unchanged — they just have no UI
  // anymore (the Asset Type select is the single way to say what the asset is).
  const [v, setV] = useState<AssetValues>({ ...EMPTY, ...(asset ?? {}) });
  const presetTypes: readonly string[] = ASSET_TYPES;
  // Custom/legacy type values (e.g. "ID Card") open in the free-text mode.
  const [typeOther, setTypeOther] = useState(() => {
    const t = asset?.assetType ?? "";
    return Boolean(t && !presetTypes.includes(t));
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => employees.find((e) => e.id === v.employeeId), [employees, v.employeeId]);

  const setStr = (k: keyof AssetValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Field label="Employee" required htmlFor="employeeId">
            <Select id="employeeId" value={v.employeeId} onChange={setStr("employeeId")} required disabled={!!assetId}>
              <option value="">Select employee…</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.empId} — {emp.name}</option>
              ))}
            </Select>
          </Field>
          {/* Compact read-only context for the selected employee — replaces the
              three always-disabled Position/Mail ID/Location mirror inputs
              (which just showed "—" until an employee was picked). Only the
              fields the `employees` prop actually carries are shown. */}
          {selected && (
            <p className="truncate rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {[selected.designation, selected.mailId, selected.location].filter(Boolean).join(" · ") || "No profile details on file"}
            </p>
          )}
        </div>

        <Field label="Asset Type" htmlFor="assetType">
          <Select
            id="assetType"
            value={typeOther ? "__OTHER__" : v.assetType}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "__OTHER__") {
                setTypeOther(true);
                setV((s) => ({ ...s, assetType: "" }));
              } else {
                setTypeOther(false);
                setV((s) => ({ ...s, assetType: val }));
              }
            }}
          >
            <option value="">Select type…</option>
            {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            <option value="__OTHER__">Other…</option>
          </Select>
          {typeOther && (
            <Input
              className="mt-2"
              value={v.assetType}
              onChange={setStr("assetType")}
              placeholder="Enter item name"
              aria-label="Custom asset type"
              maxLength={40}
            />
          )}
        </Field>
        <Field label="Make / Model" htmlFor="makeModel">
          <Input id="makeModel" value={v.makeModel} onChange={setStr("makeModel")} />
        </Field>
        <Field label="Asset Tag No" htmlFor="assetTag">
          <Input id="assetTag" value={v.assetTag} onChange={setStr("assetTag")} />
        </Field>
        <Field label="Serial No" htmlFor="lpSerialNo">
          <Input id="lpSerialNo" value={v.lpSerialNo} onChange={setStr("lpSerialNo")} />
        </Field>
        <Field label="OEM Name" htmlFor="oemName">
          <Input id="oemName" value={v.oemName} onChange={setStr("oemName")} />
        </Field>
        <Field label="Condition" htmlFor="condition">
          <Select id="condition" value={v.condition} onChange={setStr("condition")}>
            <option value="">Select condition…</option>
            {ASSET_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Purchase Value (₹)" htmlFor="purchaseValue">
          <Input id="purchaseValue" inputMode="numeric" maxLength={9} value={v.purchaseValue} onChange={(e) => setV((s) => ({ ...s, purchaseValue: digitsOnly(9)(e.target.value) }))} />
        </Field>
        <Field label="Purchase Date" htmlFor="purchaseDate">
          <Input id="purchaseDate" type="date" value={v.purchaseDate} onChange={setStr("purchaseDate")} />
        </Field>
        <Field label="Allocated On" htmlFor="allocatedAt" hint="leave blank for today">
          <Input id="allocatedAt" type="date" value={v.allocatedAt} onChange={setStr("allocatedAt")} />
        </Field>

        {assetId && (
          <Field label="Returned On" htmlFor="returnedAt" hint="leave blank if still allocated">
            <Input id="returnedAt" type="date" value={v.returnedAt ?? ""} onChange={setStr("returnedAt")} />
          </Field>
        )}

        <div className="sm:col-span-2">
          <Field label="Remarks" htmlFor="remarks">
            <Input id="remarks" value={v.remarks} onChange={setStr("remarks")} />
          </Field>
        </div>
      </div>

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
