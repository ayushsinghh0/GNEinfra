"use client";

import { useState } from "react";
import { btn } from "@/components/ui";
import { MailWarning, Check } from "lucide-react";

type State = "idle" | "sending" | "sent" | "manual" | "error";

export default function DocumentRequestButton({
  vendorId,
  documentId,
}: {
  vendorId: string;
  documentId: string;
}) {
  const [state, setState] = useState<State>("idle");
  const [detail, setDetail] = useState<string | null>(null);

  async function request() {
    setState("sending");
    setDetail(null);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/document-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send the request.");
      if (data.emailed === false) {
        setState("manual");
        setDetail(typeof data.link === "string" ? data.link : null);
      } else {
        setState("sent");
      }
    } catch (e) {
      setState("error");
      setDetail(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  if (state === "sent") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
        <Check className="h-4 w-4" />
        Re-upload email sent
      </span>
    );
  }

  if (state === "manual") {
    return (
      <span className="text-xs text-amber-700">
        Email failed — share this link:{" "}
        <span className="break-all font-medium">{detail}</span>
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
      {state === "error" && detail && (
        <span className="text-xs text-rose-600">{detail}</span>
      )}
    </span>
  );
}
