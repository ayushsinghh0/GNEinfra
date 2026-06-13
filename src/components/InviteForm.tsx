"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Send, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Card, CardHeader, CardBody, Field, Input, Button, cn } from "@/components/ui";

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

  const alertStyles = {
    ok: "bg-emerald-50 border-emerald-200 text-emerald-800",
    warn: "bg-amber-50 border-amber-200 text-amber-800",
    err: "bg-rose-50 border-rose-200 text-rose-800",
  } as const;

  const AlertIcon = msg
    ? msg.kind === "ok"
      ? CheckCircle2
      : msg.kind === "warn"
        ? AlertTriangle
        : XCircle
    : null;

  return (
    <Card>
      <CardHeader
        title="Invite a vendor"
        subtitle="Sends the vendor an email with a unique registration link."
      />
      <CardBody>
        <form onSubmit={onSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <Field label="Email" required className="flex-1">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vendor@example.com"
            />
          </Field>
          <Field label="Company" hint="optional" className="flex-1">
            <Input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company name"
            />
          </Field>
          <Button type="submit" variant="primary" disabled={loading} className="shrink-0">
            {loading ? (
              "Sending…"
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send invite
              </>
            )}
          </Button>
        </form>

        {msg && AlertIcon && (
          <div
            className={cn(
              "mt-4 flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm",
              alertStyles[msg.kind]
            )}
          >
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium">{msg.text}</div>
              {msg.link && (
                <div className="mt-1 break-all font-mono text-xs text-slate-500">{msg.link}</div>
              )}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
