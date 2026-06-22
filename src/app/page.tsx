import Link from "next/link";
import { btn } from "@/components/ui";
import { SunGlow, Atmosphere, Blob, Wave } from "@/components/chrome";
import { LogIn, ShieldCheck, ArrowRight, Sun } from "lucide-react";

export default function Home() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      {/* Page atmosphere (chrome only) */}
      <Blob className="-top-24 right-[8%] h-72 w-72" color="rgba(45,212,191,0.22)" />
      <Blob className="-bottom-20 left-[4%] h-80 w-80" color="rgba(245,158,11,0.12)" />
      <div className="gne-dots pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />

      <div className="relative w-full max-w-lg">
        <div className="relative overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-pop)]">
          {/* Sunrise band */}
          <div className="relative h-28 bg-gradient-to-br from-brand-400 via-brand-600 to-brand-700">
            <SunGlow className="-top-10 right-8 h-32 w-32" animate />
            <Atmosphere dots grain />
            <Wave className="absolute inset-x-0 bottom-[-1px]" />
          </div>

          <div className="px-8 pb-10 text-center">
            <div className="mx-auto -mt-9 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-b from-brand-500 to-brand-700 text-lg font-extrabold tracking-tight text-white shadow-[var(--shadow-cta)] ring-4 ring-white">
              GNE
            </div>

            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
              <Sun className="h-3.5 w-3.5" />
              Solar EPC · Vendor Portal
            </span>

            <h1 className="font-display mt-4 text-3xl font-extrabold tracking-[-0.02em] text-slate-900">
              GNE Vendor Portal
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600">
              GNE ERP — Phase 1. Vendors register and submit their details using the secure link
              emailed to them by our procurement team.
            </p>

            <div className="mt-8 flex justify-center">
              <Link href="/admin" className={`${btn("primary", "lg")} rounded-full`}>
                <LogIn className="h-4 w-4" />
                Admin Login
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <p className="mt-7 inline-flex items-center gap-1.5 text-xs text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Are you a vendor? Use the registration link in your invitation email.
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
