"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { btn } from "@/components/ui";

// "Import Excel" button: pick an .xlsx, upload it to `endpoint` (multipart,
// field "file"), then refresh. Used for bulk BOQ import.
export default function ExcelImport({
  endpoint,
  label = "Import Excel",
}: {
  endpoint: string;
  label?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Import failed");
      setMsg({
        ok: true,
        text: `Imported ${data.imported} item(s)${data.skipped ? `, skipped ${data.skipped}` : ""}.`,
      });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Import failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={onPick}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={btn("secondary", "sm")}
      >
        <Upload className="h-4 w-4" />
        {busy ? "Importing…" : label}
      </button>
      {msg && (
        <span className={`text-xs ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>
          {msg.text}
        </span>
      )}
    </div>
  );
}
