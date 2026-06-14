"use client";

import { useRef, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, AlertTriangle } from "lucide-react";
import {
  Card,
  CardHeader,
  CardBody,
  Field,
  Input,
  Select,
  Textarea,
  Button,
  cn,
} from "@/components/ui";
import { STAGE_ORDER, STAGE_LABELS } from "@/lib/projects";

type Vendor = { id: string; companyName: string };

const EMPTY = {
  gneId: "",
  clientName: "",
  tenderId: "",
  state: "",
  cluster: "",
  plantName: "",
  capacityAcMw: "",
  capacityDcMw: "",
  epcScope: "",
  poNumber: "",
  poValueCr: "",
  subPartner: "",
  vendorId: "",
  stage: "PLANNING",
  startDate: "",
  plantAddress: "",
  clientAddress: "",
};

export default function ProjectForm({ vendors }: { vendors: Vendor[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const bomInputRef = useRef<HTMLInputElement>(null);
  const [bomName, setBomName] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) throw new Error(d.error || "Failed to create project");

      const bom = bomInputRef.current?.files?.[0];
      if (bom) {
        setStatus("Importing BOM…");
        try {
          const fd = new FormData();
          fd.append("file", bom);
          const imp = await fetch(`/api/projects/${d.id}/boq/import`, {
            method: "POST",
            body: fd,
          });
          const id = await imp.json().catch(() => ({}));
          if (!imp.ok) throw new Error(id.error || "BOM import failed");
        } catch (impErr) {
          setError(
            impErr instanceof Error
              ? `Project created, but BOM import failed: ${impErr.message}`
              : "Project created, but BOM import failed."
          );
        }
        router.push(`/admin/projects/${d.id}?tab=boq`);
        return;
      }

      router.push(`/admin/projects/${d.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setStatus(null);
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="New project"
        subtitle="Register a project to start tracking its stage, BOQ, activities and milestones."
      />
      <CardBody className="space-y-8">
        <form onSubmit={onSubmit} className="space-y-8">
          {/* ── Identity ─────────────────────────────────────────────── */}
          <section>
            <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-slate-400">
              Identity
            </h3>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="GNE ID" required htmlFor="gneId">
                <Input
                  id="gneId"
                  required
                  value={form.gneId}
                  onChange={(e) => set("gneId", e.target.value)}
                  placeholder="GNE-2026-001"
                />
              </Field>
              <Field label="Client name" htmlFor="clientName">
                <Input
                  id="clientName"
                  value={form.clientName}
                  onChange={(e) => set("clientName", e.target.value)}
                  placeholder="Client / off-taker"
                />
              </Field>
              <Field label="Tender ID" htmlFor="tenderId">
                <Input
                  id="tenderId"
                  value={form.tenderId}
                  onChange={(e) => set("tenderId", e.target.value)}
                  placeholder="Tender reference"
                />
              </Field>
              <Field label="Plant name" htmlFor="plantName">
                <Input
                  id="plantName"
                  value={form.plantName}
                  onChange={(e) => set("plantName", e.target.value)}
                  placeholder="Plant / site name"
                />
              </Field>
              <Field label="State" htmlFor="state">
                <Input
                  id="state"
                  value={form.state}
                  onChange={(e) => set("state", e.target.value)}
                  placeholder="e.g. Rajasthan"
                />
              </Field>
              <Field label="Cluster" htmlFor="cluster">
                <Input
                  id="cluster"
                  value={form.cluster}
                  onChange={(e) => set("cluster", e.target.value)}
                  placeholder="Cluster / zone"
                />
              </Field>
            </div>
          </section>

          {/* ── Capacity & scope ─────────────────────────────────────── */}
          <section>
            <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-slate-400">
              Capacity & scope
            </h3>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Capacity AC" hint="MWac" htmlFor="capacityAcMw">
                <Input
                  id="capacityAcMw"
                  type="number"
                  step="any"
                  min="0"
                  value={form.capacityAcMw}
                  onChange={(e) => set("capacityAcMw", e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="Capacity DC" hint="MWdc" htmlFor="capacityDcMw">
                <Input
                  id="capacityDcMw"
                  type="number"
                  step="any"
                  min="0"
                  value={form.capacityDcMw}
                  onChange={(e) => set("capacityDcMw", e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="EPC scope" htmlFor="epcScope">
                <Input
                  id="epcScope"
                  value={form.epcScope}
                  onChange={(e) => set("epcScope", e.target.value)}
                  placeholder="Scope of work"
                />
              </Field>
            </div>
          </section>

          {/* ── Commercial ───────────────────────────────────────────── */}
          <section>
            <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-slate-400">
              Commercial
            </h3>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="PO number" htmlFor="poNumber">
                <Input
                  id="poNumber"
                  value={form.poNumber}
                  onChange={(e) => set("poNumber", e.target.value)}
                  placeholder="Purchase order no."
                />
              </Field>
              <Field label="PO value" hint="₹ Cr" htmlFor="poValueCr">
                <Input
                  id="poValueCr"
                  type="number"
                  step="any"
                  min="0"
                  value={form.poValueCr}
                  onChange={(e) => set("poValueCr", e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="Sub-partner" htmlFor="subPartner">
                <Input
                  id="subPartner"
                  value={form.subPartner}
                  onChange={(e) => set("subPartner", e.target.value)}
                  placeholder="Sub-contractor / partner"
                />
              </Field>
              <Field label="EPC vendor" hint="optional" htmlFor="vendorId">
                <Select
                  id="vendorId"
                  value={form.vendorId}
                  onChange={(e) => set("vendorId", e.target.value)}
                >
                  <option value="">— none —</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.companyName}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Stage" htmlFor="stage">
                <Select
                  id="stage"
                  value={form.stage}
                  onChange={(e) => set("stage", e.target.value)}
                >
                  {STAGE_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Start date" htmlFor="startDate">
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                />
              </Field>
            </div>
          </section>

          {/* ── Addresses ────────────────────────────────────────────── */}
          <section>
            <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-slate-400">
              Addresses
            </h3>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
              <Field label="Plant address" htmlFor="plantAddress">
                <Textarea
                  id="plantAddress"
                  rows={3}
                  value={form.plantAddress}
                  onChange={(e) => set("plantAddress", e.target.value)}
                  placeholder="Site / plant address"
                />
              </Field>
              <Field label="Client address" htmlFor="clientAddress">
                <Textarea
                  id="clientAddress"
                  rows={3}
                  value={form.clientAddress}
                  onChange={(e) => set("clientAddress", e.target.value)}
                  placeholder="Client billing address"
                />
              </Field>
            </div>
          </section>

          {/* ── Bill of materials ────────────────────────────────────── */}
          <section>
            <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-slate-400">
              Bill of materials
            </h3>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
              <Field
                label="BOM file (.xlsx)"
                hint="optional — imports the BOQ now"
                htmlFor="bomFile"
              >
                <input
                  ref={bomInputRef}
                  id="bomFile"
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => setBomName(e.target.files?.[0]?.name ?? null)}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-teal-700 hover:file:bg-teal-100"
                />
                {bomName && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    Selected: {bomName}
                  </p>
                )}
              </Field>
            </div>
          </section>

          {error && (
            <div
              className={cn(
                "flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm",
                "border-rose-200 bg-rose-50 text-rose-800"
              )}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="font-medium">{error}</div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
            {status && (
              <span className="text-sm text-slate-500">{status}</span>
            )}
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? (
                status ?? "Creating…"
              ) : (
                <>
                  <FolderPlus className="h-4 w-4" />
                  Create project
                </>
              )}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
