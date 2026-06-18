"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Upload, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardBody, Button } from "@/components/ui";

type ImportedProject = {
  id: string;
  gneId: string;
  status: "created" | "updated";
  activities: number;
  procurement: number;
};

type ImportResult = {
  ok: boolean;
  projects: ImportedProject[];
  perSheet: {
    projectsCreated: number;
    projectsUpdated: number;
    activities: number;
    dprEntries: number;
    procurement: number;
    skipped: {
      projectDetails: number;
      activityDpr: number;
      poMrc: number;
      unrecognisedSheets: number;
    };
    sheetsFound: { projectDetails: boolean; activityDpr: boolean; poMrc: boolean };
  };
  errors: { gneId: string; error: string }[];
};

// "Upload workbook" panel for /admin/projects/new. Pick the full GNE master
// workbook (Project Details & DPR), POST it to /api/projects/import-workbook, and
// render a summary: created/updated projects (with links) + per-sheet counts.
export default function WorkbookUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Choose an .xlsx workbook first.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/projects/import-workbook", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Import failed");
      setResult(data as ImportResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  const skipped = result?.perSheet.skipped;
  const skippedTotal = skipped
    ? skipped.projectDetails + skipped.activityDpr + skipped.poMrc
    : 0;

  return (
    <Card>
      <CardHeader
        title="Upload workbook"
        subtitle="Drop the GNE “Project Details & DPR” workbook to auto-fill projects, activities and PO/MRC. Re-uploading updates existing projects in place (matched by GNE ID)."
      />
      <CardBody className="space-y-5">
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label
              htmlFor="workbookFile"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Workbook (.xlsx)
            </label>
            <input
              ref={inputRef}
              id="workbookFile"
              type="file"
              accept=".xlsx"
              onChange={(e) => {
                setFileName(e.target.files?.[0]?.name ?? null);
                setError(null);
                setResult(null);
              }}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-teal-700 hover:file:bg-teal-100"
            />
            {fileName && (
              <p className="mt-1.5 text-xs text-slate-500">Selected: {fileName}</p>
            )}
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={onUpload}
            disabled={busy || !fileName}
          >
            <Upload className="h-4 w-4" />
            {busy ? "Importing…" : "Import workbook"}
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="font-medium">{error}</div>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <span className="font-semibold">Import complete.</span>{" "}
                {result.perSheet.projectsCreated} created,{" "}
                {result.perSheet.projectsUpdated} updated ·{" "}
                {result.perSheet.activities} activities,{" "}
                {result.perSheet.dprEntries} daily entries,{" "}
                {result.perSheet.procurement} PO/MRC rows
                {skippedTotal > 0 && <> · {skippedTotal} rows skipped</>}
                {result.perSheet.skipped.unrecognisedSheets > 0 && (
                  <> · {result.perSheet.skipped.unrecognisedSheets} sheets ignored</>
                )}
                .
              </div>
            </div>

            {result.projects.length > 0 && (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
                {result.projects.map((p) => (
                  <li
                    key={p.gneId}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-slate-900">{p.gneId}</span>
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === "created"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {p.status}
                      </span>
                      <span className="ml-2 text-xs text-slate-500">
                        {p.activities} activities · {p.procurement} PO/MRC
                      </span>
                    </div>
                    <Link
                      href={`/admin/projects/${p.id}`}
                      className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800"
                    >
                      Open
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {result.errors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                <div className="mb-1 flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  {result.errors.length} project(s) failed
                </div>
                <ul className="list-inside list-disc text-xs">
                  {result.errors.map((e) => (
                    <li key={e.gneId}>
                      {e.gneId}: {e.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
