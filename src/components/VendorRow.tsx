"use client";

import { useRouter } from "next/navigation";
import { Wrench, FileText, ChevronRight } from "lucide-react";
import Badge from "@/components/Badge";
import { tdCls, trCls, cn } from "@/components/ui";

export type VendorRowData = {
  id: string;
  companyName: string;
  contactPerson: string | null;
  email: string;
  gstNo: string;
  panNo: string;
  state: string | null;
  services: number;
  documents: number;
  status: string;
  submitted: string | null;
};

// A whole-row clickable table row (navigates to the vendor detail page).
// Kept as a client component so the entire row is the click target — no
// separate "View" button needed, which also lets the table fit without
// horizontal scrolling.
export default function VendorRow({ v }: { v: VendorRowData }) {
  const router = useRouter();
  const href = `/admin/vendors/${v.id}`;

  return (
    <tr
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(href);
      }}
      tabIndex={0}
      role="link"
      className={cn(trCls, "group cursor-pointer outline-none focus-visible:bg-slate-50")}
    >
      <td className={tdCls}>
        <div className="truncate font-medium text-slate-900 group-hover:text-brand-700 transition-colors">
          {v.companyName}
        </div>
        {v.contactPerson && (
          <div className="truncate text-xs text-slate-400">{v.contactPerson}</div>
        )}
      </td>
      <td className={tdCls}>
        <div className="truncate text-slate-600">{v.email}</div>
      </td>
      <td className={tdCls}>
        <div className="truncate font-mono text-xs text-slate-600">{v.gstNo}</div>
        <div className="truncate font-mono text-xs text-slate-400">{v.panNo}</div>
      </td>
      <td className={cn(tdCls, "text-slate-600")}>
        <div className="truncate">{v.state || "—"}</div>
      </td>
      <td className={tdCls}>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1" title="Services">
            <Wrench className="h-3.5 w-3.5 text-slate-400" />
            {v.services}
          </span>
          <span className="inline-flex items-center gap-1" title="Documents">
            <FileText className="h-3.5 w-3.5 text-slate-400" />
            {v.documents}
          </span>
        </div>
      </td>
      <td className={tdCls}>
        <Badge value={v.status} />
      </td>
      <td className={cn(tdCls, "text-slate-500")}>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs tabular-nums">{v.submitted || "—"}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-brand-600" />
        </div>
      </td>
    </tr>
  );
}
