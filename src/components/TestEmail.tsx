"use client";

import { useState, FormEvent } from "react";

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
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3">
      <input
        type="email"
        required
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="you@company.com"
        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
      />
      <button
        type="submit"
        disabled={loading}
        className="px-5 py-2 rounded-lg bg-brand text-white font-semibold hover:opacity-90 transition disabled:opacity-50 whitespace-nowrap"
      >
        {loading ? "Sending…" : "Send test email"}
      </button>
      {msg && (
        <span
          className={`self-center text-sm ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}
        >
          {msg.text}
        </span>
      )}
    </form>
  );
}
