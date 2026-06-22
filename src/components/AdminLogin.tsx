"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Eyebrow } from "@/components/ui";
import { SunGlow, Atmosphere, Wave, Blob, RayArcs } from "@/components/chrome";
import {
  LockKeyhole,
  AlertCircle,
  Mail,
  FileText,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
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
    <main className="min-h-dvh bg-white lg:grid lg:grid-cols-2">
      {/* ── Brand panel: mobile = sunrise hero w/ wave; desktop = full-height left ── */}
      <div className="relative isolate overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 px-6 pt-12 pb-16 text-white lg:flex lg:h-dvh lg:flex-col lg:justify-between lg:px-12 lg:py-12">
        <SunGlow className="-top-16 -right-10 h-56 w-56" animate />
        <Blob className="-bottom-12 -left-12 h-72 w-72" color="rgba(16,185,129,0.22)" />
        <Atmosphere dots grain />
        <RayArcs className="-top-10 right-6 hidden h-48 w-48 lg:block" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 font-extrabold tracking-tight ring-1 ring-white/25 backdrop-blur">
            GNE
          </div>
          <div>
            <div className="font-semibold leading-tight">GNE ERP</div>
            <div className="text-xs text-white/70">Vendor Portal</div>
          </div>
        </div>

        <div className="relative z-10 mt-8 lg:mt-0">
          <Eyebrow className="text-white">Solar EPC · Procurement</Eyebrow>
          <h2 className="font-display mt-3 max-w-sm text-3xl font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-4xl">
            Vendor management for solar EPC, done right.
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/90">
            Onboard suppliers, verify their compliance details, and keep every document in order — all in one place.
          </p>
        </div>

        <ul className="relative z-10 mt-8 hidden space-y-3 lg:block">
          {features.map((f) => (
            <li key={f.text} className="flex items-center gap-3 text-sm text-white/90">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
                <f.icon className="h-4 w-4" />
              </span>
              {f.text}
            </li>
          ))}
        </ul>

        <Wave className="absolute inset-x-0 bottom-[-1px] lg:hidden" />
      </div>

      {/* ── Form panel ── */}
      <div className="flex items-center justify-center px-6 py-12 lg:py-0">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <Eyebrow className="text-brand-700">Secure access</Eyebrow>
          <h1 className="font-display mt-2 text-3xl font-extrabold tracking-[-0.02em] text-slate-900">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">Sign in to the procurement console.</p>

          {error && (
            <div
              role="alert"
              className="animate-fade-up mt-6 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6">
            <Field label="Password" htmlFor="admin-password">
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="admin-password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  autoComplete="current-password"
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="press absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
          </div>

          <Button type="submit" size="lg" disabled={loading} className="mt-6 w-full rounded-full">
            {loading ? (
              "Signing in…"
            ) : (
              <>
                Sign in
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            AES-256 · TLS · Procurement access only
          </p>
        </form>
      </div>
    </main>
  );
}
