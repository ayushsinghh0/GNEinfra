"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, btn, cn } from "@/components/ui";
import { Check, X, Eye, RotateCcw, AlertCircle } from "lucide-react";

type Status = "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";

// Actions that change a vendor's standing get a one-step inline confirm; the
// neutral "move under review" / "reopen" transitions apply immediately.
const NEEDS_CONFIRM: Record<string, { verb: string; tone: "approve" | "reject" }> = {
  APPROVED: { verb: "approve", tone: "approve" },
  REJECTED: { verb: "reject", tone: "reject" },
};

export default function VendorStatusActions({
  vendorId,
  status,
  vendorCode,
}: {
  vendorId: string;
  status: string;
  vendorCode: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Status | null>(null);
  const [confirm, setConfirm] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function apply(next: Status) {
    setBusy(next);
    setError(null);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not update the vendor.");
      setConfirm(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  function onClick(next: Status) {
    setError(null);
    if (NEEDS_CONFIRM[next]) setConfirm(next);
    else apply(next);
  }

  // Inline confirmation for approve / reject.
  if (confirm) {
    const meta = NEEDS_CONFIRM[confirm];
    const busyThis = busy === confirm;
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          {confirm === "APPROVED" && !vendorCode
            ? "Approve this vendor? A unique vendor code will be assigned."
            : `Are you sure you want to ${meta.verb} this vendor?`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={meta.tone === "reject" ? "danger" : "primary"}
            disabled={busyThis}
            onClick={() => apply(confirm)}
          >
            {busyThis ? "Working…" : `Yes, ${meta.verb}`}
          </Button>
          <button
            type="button"
            disabled={busyThis}
            onClick={() => setConfirm(null)}
            className={btn("secondary", "md")}
          >
            Cancel
          </button>
        </div>
        {error && <ErrorLine message={error} />}
      </div>
    );
  }

  const actions: { next: Status; label: string; icon: React.ReactNode; variant: "primary" | "secondary" | "danger" | "ghost" }[] = [];
  if (status !== "APPROVED")
    actions.push({ next: "APPROVED", label: "Approve", icon: <Check className="h-4 w-4" />, variant: "primary" });
  if (status !== "UNDER_REVIEW" && status !== "APPROVED")
    actions.push({ next: "UNDER_REVIEW", label: "Mark under review", icon: <Eye className="h-4 w-4" />, variant: "secondary" });
  if (status !== "REJECTED")
    actions.push({ next: "REJECTED", label: "Reject", icon: <X className="h-4 w-4" />, variant: "danger" });
  if (status !== "SUBMITTED")
    actions.push({ next: "SUBMITTED", label: "Reopen", icon: <RotateCcw className="h-4 w-4" />, variant: "ghost" });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((a) => (
          <Button
            key={a.next}
            type="button"
            variant={a.variant}
            disabled={busy !== null}
            onClick={() => onClick(a.next)}
            className={cn(a.variant === "ghost" && "border border-slate-200")}
          >
            {busy === a.next ? "Working…" : (
              <>
                {a.icon}
                {a.label}
              </>
            )}
          </Button>
        ))}
      </div>
      {error && <ErrorLine message={error} />}
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
