import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { btn } from "@/components/ui";
import { SunGlow, Atmosphere, Blob, Wave } from "@/components/chrome";
import { LogIn, ShieldCheck, ArrowRight, Sun } from "lucide-react";

export const metadata: Metadata = {
  title: "GNE ERP — Staff sign-in",
  description: "Staff console for the GNE solar-EPC ERP. Sign in to your department workspace.",
};

// The five line departments — shown as quiet "what's inside" scent.
const MODULES = ["BD", "SCM", "Project", "Finance", "HR"];

export default function Home() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      {/* Page atmosphere — chrome only (no form fields / tables on this page). */}
      <Blob className="-top-32 right-[6%] h-80 w-80" color="rgba(45,212,191,0.20)" />
      <Blob className="top-1/3 -left-28 h-[26rem] w-[26rem]" color="rgba(245,158,11,0.10)" />
      <Blob className="-bottom-28 right-1/4 h-80 w-80" color="rgba(20,184,166,0.10)" />
      <div className="gne-dots pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />

      <div className="animate-fade-up relative w-full max-w-md">
        <div className="relative overflow-hidden rounded-[28px] bg-white shadow-[var(--shadow-pop)]">
          {/* Sunrise hero band */}
          <div className="relative h-32 bg-gradient-to-br from-brand-400 via-brand-600 to-brand-700">
            <SunGlow className="-top-12 right-6 h-40 w-40" animate />
            <Atmosphere dots grain />
            <Wave className="absolute inset-x-0 bottom-[-1px]" height={40} />
          </div>

          {/* Content — sits ABOVE the positioned band (z-10) so the logo shows. */}
          <div className="relative z-10 px-8 pb-9 text-center">
            {/* Floating logo plate, straddling the wave. */}
            <div className="-mt-12 flex justify-center">
              <div className="grid place-items-center rounded-[20px] bg-white px-6 py-3.5 shadow-[var(--shadow-card)] ring-1 ring-slate-900/[0.04]">
                <Image
                  src="/brand/gne-infra.png"
                  alt="GNE Infra"
                  width={277}
                  height={106}
                  className="h-10 w-auto"
                  priority
                />
              </div>
            </div>

            <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
              <Sun className="h-3.5 w-3.5 text-accent" />
              Solar EPC · ERP
            </span>

            <h1 className="font-display mt-4 text-[2rem] font-extrabold leading-tight tracking-[-0.02em] text-slate-900">
              GNE ERP
            </h1>
            <p className="mx-auto mt-2.5 max-w-xs text-sm leading-relaxed text-slate-500">
              One workspace for every department. Staff sign in to their department console.
            </p>

            {/* Module scent — echoes the login hero's department list. */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
              {MODULES.map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200/70"
                >
                  {m}
                </span>
              ))}
            </div>

            <div className="mt-7">
              <Link href="/login" className={`${btn("primary", "lg")} w-full rounded-full`}>
                <LogIn className="h-4 w-4" />
                Staff Login
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <p className="mt-6 flex items-center justify-center gap-1.5 border-t border-slate-100 pt-5 text-xs text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Vendor? Use the registration link in your invitation email.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} GNE · Powering the energy transition.
        </p>
      </div>
    </main>
  );
}
