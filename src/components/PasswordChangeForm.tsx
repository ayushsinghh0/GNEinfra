"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Card, CardBody, CardHeader } from "@/components/ui";
import { AlertCircle, KeyRound } from "lucide-react";

export default function PasswordChangeForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) return setError("New passwords do not match.");
    if (newPassword.length < 8) return setError("New password must be at least 8 characters.");
    setLoading(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not change password");
      router.push(d.redirect || "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader
        title={<span className="flex items-center gap-2"><KeyRound className="h-[18px] w-[18px] text-brand" /> Set a new password</span>}
        subtitle={forced ? "Choose a new password to finish setting up your account." : "Update your account password."}
      />
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
            </div>
          )}
          <Field label="Current password" htmlFor="cur"><Input id="cur" type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" /></Field>
          <Field label="New password" htmlFor="new"><Input id="new" type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} autoComplete="new-password" /></Field>
          <Field label="Confirm new password" htmlFor="cfm"><Input id="cfm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></Field>
          <Button type="submit" size="lg" disabled={loading} className="w-full">{loading ? "Saving…" : "Save password"}</Button>
        </form>
      </CardBody>
    </Card>
  );
}
