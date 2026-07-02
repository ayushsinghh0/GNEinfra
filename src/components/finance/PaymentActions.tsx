"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeIndianRupee, Undo2 } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";

/**
 * Paid / not-paid marking for an APPROVED invoice — the Finance role's call.
 * Render only for FINANCE_WRITE viewers; the API enforces the same set.
 */
export default function PaymentActions({
  invoiceId,
  invoiceNo,
  paid,
}: {
  invoiceId: string;
  invoiceNo: string;
  paid: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentRef, setPaymentRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doMark(nextPaid: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/invoices/${invoiceId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPaid ? { paid: true, paymentDate, paymentRef } : { paid: false }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not update payment status");
      setOpen(false);
      toast(nextPaid ? "Marked as paid" : "Marked as unpaid");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update payment status");
    } finally {
      setBusy(false);
    }
  }

  if (paid) {
    return (
      <>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setError(null); setOpen(true); }}>
          <Undo2 className="h-3.5 w-3.5" /> Mark unpaid
        </Button>
        <ConfirmDialog
          open={open}
          title={`Mark ${invoiceNo} as unpaid?`}
          message={error ?? "This clears the recorded payment date and reference."}
          confirmLabel="Mark unpaid"
          variant="danger"
          busy={busy}
          onCancel={() => !busy && setOpen(false)}
          onConfirm={() => doMark(false)}
        />
      </>
    );
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => { setError(null); setOpen(true); }}>
        <BadgeIndianRupee className="h-4 w-4" /> Mark paid
      </Button>
      <ConfirmDialog
        open={open}
        title={`Mark ${invoiceNo} as paid?`}
        message="Record when and how the payment was made."
        confirmLabel="Mark paid"
        busy={busy}
        onCancel={() => !busy && setOpen(false)}
        onConfirm={() => doMark(true)}
      >
        <div className="space-y-3">
          <Field label="Payment date" htmlFor="payment-date">
            <Input
              id="payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </Field>
          <Field label="Reference" htmlFor="payment-ref" hint="UTR / cheque no / transaction id (optional)">
            <Input
              id="payment-ref"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              maxLength={120}
            />
          </Field>
          {error && <p className="text-[13px] text-rose-600">{error}</p>}
        </div>
      </ConfirmDialog>
    </>
  );
}
