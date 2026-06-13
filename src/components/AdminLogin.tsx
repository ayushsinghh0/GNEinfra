"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { LockKeyhole, LogIn, AlertCircle, Mail, FileText, ShieldCheck } from "lucide-react";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Login failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  const features = [
    { icon: Mail, text: "Invite vendors by email with a secure link" },
    { icon: FileText, text: "Collect GST, PAN, bank details & documents" },
    { icon: ShieldCheck, text: "Everything stored in one auditable place" },
  ];

  return (
    <main className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-slate-900 p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 font-bold tracking-tight ring-1 ring-white/20 backdrop-blur">
            GNE
          </div>
          <div>
            <div className="font-semibold leading-tight">GNE ERP</div>
            <div className="text-xs text-white/60">Vendor Portal</div>
          </div>
        </div>

        <div className="relative">
          <h2 className="max-w-sm text-3xl font-semibold leading-tight tracking-tight">
            Vendor management for solar EPC, done right.
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">
            Onboard suppliers, verify their compliance details, and keep every
            document in order — all in one place.
          </p>
        </div>

        <ul className="relative space-y-3">
          {features.map((f) => (
            <li key={f.text} className="flex items-center gap-3 text-sm text-white/80">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
                <f.icon className="h-4 w-4" />
              </span>
              {f.text}
            </li>
          ))}
        </ul>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center bg-white p-6 lg:w-1/2">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand font-bold text-white">
              GNE
            </div>
            <span className="font-semibold text-slate-900">GNE ERP</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Sign in to the procurement admin panel.
          </p>

          {error && (
            <div className="mt-6 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6">
            <Field label="Password" htmlFor="admin-password">
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  className="pl-9"
                />
              </div>
            </Field>
          </div>

          <Button type="submit" disabled={loading} className="mt-6 w-full">
            <LogIn className="h-4 w-4" />
            {loading ? "Signing in…" : "Sign in"}
          </Button>

          <p className="mt-8 text-center text-xs text-slate-400">
            GNE ERP · Procurement access only
          </p>
        </form>
      </div>
    </main>
  );
}
