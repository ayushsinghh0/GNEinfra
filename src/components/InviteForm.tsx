"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "warn" | "err"; text: string; link?: string } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, companyHint: company }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed to create invite");

      if (d.emailed) {
        setMsg({ kind: "ok", text: `Invitation emailed to ${email}.`, link: d.link });
      } else {
        setMsg({
          kind: "warn",
          text: d.warning || "Invite created, but email failed. Share the link manually.",
          link: d.link,
        });
      }
      setEmail("");
      setCompany("");
      router.refresh();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Invite a vendor</h2>
      <p className="text-sm text-slate-500 mb-4">
        Sends the vendor an email with a unique registration link.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vendor@example.com"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company name (optional)"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 rounded-lg bg-brand text-white font-semibold hover:opacity-90 transition disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "Sending…" : "Send invite"}
        </button>
      </form>
      {msg && (
        <div
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            msg.kind === "ok"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : msg.kind === "warn"
                ? "bg-amber-50 border border-amber-200 text-amber-700"
                : "bg-rose-50 border border-rose-200 text-rose-700"
          }`}
        >
          <div>{msg.text}</div>
          {msg.link && (
            <div className="mt-1 break-all text-xs text-slate-500">{msg.link}</div>
          )}
        </div>
      )}
    </div>
  );
}
