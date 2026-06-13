import Link from "next/link";
import { btn } from "@/components/ui";
import { LogIn, ShieldCheck, ArrowRight, Sun } from "lucide-react";

export default function Home() {
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-lg font-bold tracking-tight text-white shadow-sm">
            GNE
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <Sun className="h-3.5 w-3.5" />
            Solar EPC · Vendor Portal
          </span>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            GNE Vendor Portal
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600">
            GNE ERP — Phase 1. Vendors register and submit their details using
            the secure link emailed to them by our procurement team.
          </p>

          <div className="mt-8 flex justify-center">
            <Link href="/admin" className={btn("primary")}>
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

        <p className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} GNE · Powering the energy transition.
        </p>
      </div>
    </main>
  );
}
