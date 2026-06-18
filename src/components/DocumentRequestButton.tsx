"use client";

import { useState } from "react";
import { btn } from "@/components/ui";
import { MailWarning, Check, Copy } from "lucide-react";

type State = "idle" | "sending" | "done" | "error";

export default function DocumentRequestButton({
  vendorId,
  documentId,
}: {
  vendorId: string;
  documentId: string;
}) {
  const [state, setState] = useState<State>("idle");
  const [link, setLink] = useState<string | null>(null);
  const [emailed, setEmailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request() {
    setState("sending");
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/document-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send the request.");
      setLink(typeof data.link === "string" ? data.link : null);
      setEmailed(data.emailed !== false);
      setState("done");
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. insecure context) — the link text is still
      // visible for the admin to select and copy manually.
    }
  }

  if (state === "done") {
    return (
      <span className="inline-flex max-w-xs flex-col items-end gap-1.5 text-right">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
            emailed ? "text-emerald-600" : "text-amber-700"
          }`}
        >
          <Check className="h-4 w-4" />
          {emailed ? "Re-upload email sent" : "Email not sent — share the link"}
        </span>
        {link && (
          <>
            <span className="block w-full break-all rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
              {link}
            </span>
            <button type="button" onClick={copyLink} className={btn("secondary", "sm")}>
              <Copy className="h-4 w-4" />
              {copied ? "Copied!" : "Copy link"}
            </button>
          </>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={request}
        disabled={state === "sending"}
        className={btn("secondary", "sm")}
      >
        <MailWarning className="h-4 w-4" />
        {state === "sending" ? "Sending…" : "Request new file"}
      </button>
      {state === "error" && error && (
        <span className="text-xs text-rose-600">{error}</span>
      )}
    </span>
  );
}
