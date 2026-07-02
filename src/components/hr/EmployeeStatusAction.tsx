"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserMinus, UserCheck } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";

function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export default function EmployeeStatusAction({
  employeeId,
  status,
  size = "sm",
}: {
  employeeId: string;
  status: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const leaving = status === "ACTIVE";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(todayStr());

  async function go() {
    setBusy(true);
    try {
      const res = await fetch(`/api/hr/employees/${employeeId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leaving ? { action: "leave", leavingDate: date } : { action: "reactivate" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not update status");
      }
      setOpen(false);
      toast(leaving ? "Employee marked as leaving" : "Employee reactivated");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update status", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={leaving ? "danger" : "secondary"}
        size={size}
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        {leaving ? (
          <>
            <UserMinus className="h-4 w-4" /> Mark as leaving
          </>
        ) : (
          <>
            <UserCheck className="h-4 w-4" /> Reactivate
          </>
        )}
      </Button>
      <ConfirmDialog
        open={open}
        title={leaving ? "Mark employee as leaving?" : "Reactivate employee?"}
        message={
          leaving
            ? "This sets the employee to INACTIVE and records a leaving date. You can reactivate later."
            : "This restores the employee to ACTIVE and clears the leaving date."
        }
        confirmLabel={leaving ? "Mark as leaving" : "Reactivate"}
        variant={leaving ? "danger" : "primary"}
        busy={busy}
        onCancel={() => setOpen(false)}
        onConfirm={go}
      >
        {leaving && (
          <Field label="Leaving date" htmlFor="leaving-date">
            <Input
              id="leaving-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        )}
      </ConfirmDialog>
    </>
  );
}
