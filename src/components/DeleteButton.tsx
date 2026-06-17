"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { btn, cn } from "@/components/ui";

// A small confirm-then-DELETE control for record rows. On success it refreshes
// the server data; on failure it surfaces the server message inline.
export default function DeleteButton({
  endpoint,
  confirm,
  label = "Delete",
  iconOnly = false,
  className,
}: {
  endpoint: string;
  confirm: string;
  label?: string;
  iconOnly?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (!window.confirm(confirm)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not delete");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setBusy(false);
    }
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        title={error ?? label}
        aria-label={label}
        className={cn(
          "grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50",
          error && "text-rose-600",
          className
        )}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      title={error ?? undefined}
      className={cn(btn("ghost", "sm"), "text-rose-600 hover:bg-rose-50", className)}
    >
      <Trash2 className="h-4 w-4" />
      {busy ? "Deleting…" : label}
    </button>
  );
}
