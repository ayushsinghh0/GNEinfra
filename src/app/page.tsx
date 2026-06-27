import Link from "next/link";
import Image from "next/image";
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
            <div className="mx-auto -mt-9 grid h-16 w-28 place-items-center rounded-2xl bg-white px-4 shadow-[var(--shadow-cta)] ring-4 ring-white">
              <Image src="/brand/gne-infra.png" alt="GNE Infra" width={96} height={28} className="h-7 w-auto" priority />
            </div>

            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
              <Sun className="h-3.5 w-3.5" />
              Solar EPC · ERP
            </span>

            <h1 className="font-display mt-4 text-3xl font-extrabold tracking-[-0.02em] text-slate-900">
              GNE ERP
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600">
              Staff sign-in to the GNE ERP. Vendors: use the registration link in your invitation email.
            </p>

            <div className="mt-8 flex justify-center">
              <Link href="/login" className={`${btn("primary", "lg")} rounded-full`}>
                <LogIn className="h-4 w-4" />
                Staff Login
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
