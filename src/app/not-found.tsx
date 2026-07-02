import Link from "next/link";
import Image from "next/image";
import { btn } from "@/components/ui";

/* Global 404 — replaces Next's unbranded black default. Public-safe (renders
   outside the authed shell for unmatched top-level URLs), so it shows no data
   and assumes no session: just the brand, the message, and a way home. */
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-[var(--shadow-card)]">
        <span className="mx-auto grid h-12 w-fit place-items-center rounded-xl bg-white px-3 ring-1 ring-slate-200">
          <Image src="/brand/gne-infra.png" alt="GNE Infra" width={92} height={26} className="h-6 w-auto" />
        </span>
        <p className="nums mt-6 font-display text-5xl font-semibold tracking-tight text-slate-900">404</p>
        <h1 className="mt-2 text-sm font-semibold text-slate-800">Page not found</h1>
        <p className="mt-1 text-sm text-slate-500">
          The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved.
        </p>
        <Link href="/" className={`${btn("primary", "md")} mt-6`}>
          Go to home
        </Link>
      </div>
    </main>
  );
}
