import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-brand text-white text-2xl font-bold mb-5">
          GNE
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Vendor Portal</h1>
        <p className="mt-3 text-slate-600 leading-relaxed">
          GNE ERP — Phase 1. Vendors register using the secure link emailed to
          them by our procurement team.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/admin"
            className="px-6 py-3 rounded-lg bg-brand text-white font-semibold hover:opacity-90 transition"
          >
            Admin Login
          </Link>
        </div>
        <p className="mt-6 text-xs text-slate-400">
          Are you a vendor? Please use the registration link in your invitation
          email.
        </p>
      </div>
    </main>
  );
}
