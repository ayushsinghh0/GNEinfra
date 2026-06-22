"use client";

import { useState } from "react";
import { Button, Eyebrow } from "@/components/ui";
import { SunGlow, Atmosphere, Wave, Blob, SuccessCheck } from "@/components/chrome";
import Dropzone from "@/components/Dropzone";
import { AlertCircle, ShieldCheck } from "lucide-react";

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

  function onFiles(files: File[]) {
    const f = files[0] ?? null;
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
      <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
        <Blob className="-top-24 right-[10%] h-72 w-72" color="rgba(20,184,166,0.18)" />
        <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white p-10 text-center shadow-[var(--shadow-pop)]">
          <SuccessCheck className="mx-auto mb-2" />
          <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-slate-900">
            Upload received
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Thank you. Your {docLabel} has been received by GNE procurement. This link is now closed.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      <Blob className="-top-24 right-[8%] h-72 w-72" color="rgba(45,212,191,0.2)" />
      <Blob className="-bottom-20 left-[6%] h-72 w-72" color="rgba(245,158,11,0.12)" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-pop)]">
        <div className="relative h-24 bg-gradient-to-br from-brand-400 via-brand-600 to-brand-700">
          <SunGlow className="-top-10 right-8 h-32 w-32" animate />
          <Atmosphere dots grain />
          <div className="absolute left-7 top-7 grid h-11 w-11 place-items-center rounded-2xl bg-white/15 text-sm font-extrabold tracking-tight text-white ring-1 ring-inset ring-white/25 backdrop-blur">
            GNE
          </div>
          <Wave className="absolute inset-x-0 bottom-[-1px]" />
        </div>

        <div className="px-8 pb-8 pt-2">
          <Eyebrow className="text-brand-700">Document re-upload</Eyebrow>
          <h1 className="font-display mt-1.5 text-2xl font-extrabold tracking-[-0.02em] text-slate-900">
            Re-upload your {docLabel}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Please choose a clear copy (PDF or image, max 10 MB). This link can be used once.
          </p>

          <div className="mt-5">
            <Dropzone label={`Upload ${docLabel}`} onFiles={onFiles} error={error ?? undefined} />
          </div>

          {error && !file && (
            <div
              role="alert"
              className="animate-fade-up mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Encrypted in transit
            </span>
            <Button type="button" onClick={submit} disabled={submitting || !file} className="rounded-full px-6">
              {submitting ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
