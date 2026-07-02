"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button, Field, Textarea } from "@/components/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";

/**
 * Approve / Reject sign-off for a PENDING_APPROVAL invoice. Rendered only for
 * FINANCE_APPROVE viewers (Manager / Admin / Superadmin) — the API enforces
 * the same set, plus the only-when-pending transition.
 */
export default function DecisionActions({ invoiceId, invoiceNo }: { invoiceId: string; invoiceNo: string }) {
  const router = useRouter();
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openDialog(d: "APPROVED" | "REJECTED") {
    setRemarks("");
    setError(null);
    setDecision(d);
  }

  async function doDecide() {
    if (!decision) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/invoices/${invoiceId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, remarks }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not record the decision");
      const done = decision;
      setDecision(null);
      toast(done === "APPROVED" ? "Invoice approved" : "Invoice rejected");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the decision");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => openDialog("APPROVED")}>
        <CheckCircle2 className="h-4 w-4" /> Approve
      </Button>
      <Button type="button" variant="danger" size="sm" onClick={() => openDialog("REJECTED")}>
        <XCircle className="h-4 w-4" /> Reject
      </Button>

      <ConfirmDialog
        open={decision !== null}
        title={decision === "APPROVED" ? `Approve ${invoiceNo}?` : `Reject ${invoiceNo}?`}
        message={
          decision === "APPROVED"
            ? "Your name, role and the time will be recorded on the approval note."
            : "Finance will be able to edit the invoice and resubmit it."
        }
        confirmLabel={decision === "APPROVED" ? "Approve" : "Reject"}
        variant={decision === "APPROVED" ? "primary" : "danger"}
        busy={busy}
        onCancel={() => !busy && setDecision(null)}
        onConfirm={doDecide}
      >
        <Field label="Remarks" htmlFor="decision-remarks" hint={decision === "REJECTED" ? "Tell Finance what to fix" : undefined}>
          <Textarea
            id="decision-remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            maxLength={1000}
          />
        </Field>
        {error && <p className="mt-2 text-[13px] text-rose-600">{error}</p>}
      </ConfirmDialog>
    </>
  );
}
