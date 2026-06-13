"use client";

import { useEffect } from "react";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { btn } from "@/components/ui";

// Toolbar shown on the vendor print page. Hidden when actually printing.
// Auto-opens the print dialog once so the user can "Save as PDF" immediately.
export default function PrintBar({ backHref }: { backHref: string }) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="print:hidden sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur">
      <Link href={backHref} className={btn("secondary", "sm")}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>
      <button onClick={() => window.print()} className={btn("primary", "sm")}>
        <Printer className="h-4 w-4" />
        Print / Save as PDF
      </button>
    </div>
  );
}
