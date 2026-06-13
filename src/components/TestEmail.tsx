"use client";

import { useState, FormEvent } from "react";
import { Mail, Send, Check, AlertCircle } from "lucide-react";
import { Button, Field, Input, cn } from "@/components/ui";

export default function TestEmail({ defaultTo }: { defaultTo?: string }) {
  const [to, setTo] = useState(defaultTo ?? "");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed to send");
      setMsg({ ok: true, text: `Test email sent to ${to}.` });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <Field
          label="Recipient"
          htmlFor="test-email-to"
          className="flex-1"
        >
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="test-email-to"
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="you@company.com"
              className="pl-9"
            />
          </div>
        </Field>
        <Button type="submit" variant="primary" disabled={loading} className="shrink-0">
          <Send className="h-4 w-4" />
          {loading ? "Sending…" : "Send test email"}
        </Button>
      </div>

      {msg && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
            msg.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          )}
        >
          {msg.ok ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}
    </form>
  );
}
