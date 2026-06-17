"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";

// Mirror the server's accepted types + size cap (src/lib/documents.ts) so an
// unsupported/oversize file is rejected before the single-use token is spent.
const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

function validateFile(file: File): string | null {
  if (file.size > MAX_BYTES) return `"${file.name}" is larger than 10 MB`;
  if (!file.type || !ALLOWED.includes(file.type.toLowerCase()))
    return `"${file.name}" must be a PDF, JPG, PNG or WEBP file`;
  return null;
}

export default function ReuploadForm({
  token,
  docLabel,
}: {
  token: string;
  docLabel: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function onSelect(f: File | null) {
    setFile(f);
    setError(f ? validateFile(f) : null);
  }

  async function submit() {
    if (!file) {
      setError("Please choose a file to upload.");
      return;
    }
    const v = validateFile(file);
    if (v) {
      setError(v);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("token", token);
      fd.set("file", file);
      const res = await fetch("/api/reupload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed. Please try again.");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200/80 p-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Upload received</h1>
          <p className="mt-2 text-sm text-slate-600">
            Thank you. Your {docLabel} has been received by GNE procurement. This link is now closed.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200/80 p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand text-white text-sm font-bold tracking-tight shadow-sm">
          GNE
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Re-upload your {docLabel}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Please choose a clear copy (PDF or image, max 10 MB). This link can be used once.
        </p>

        <label
          className={`mt-5 block cursor-pointer rounded-lg border border-dashed px-4 py-3 transition-colors ${
            error
              ? "border-rose-300 bg-rose-50/40"
              : "border-slate-300 bg-slate-50/50 hover:border-brand hover:bg-brand-50/40"
          }`}
        >
          <span className="flex items-center gap-2 text-xs text-slate-500">
            <UploadCloud className="h-4 w-4" />
            {file ? file.name : "Choose a PDF or image"}
          </span>
          <input
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
          />
        </label>

        {error && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={submit} disabled={submitting || !file} className="px-6">
            {submitting ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </div>
    </main>
  );
}
