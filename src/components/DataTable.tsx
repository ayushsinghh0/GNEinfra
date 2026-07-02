import * as React from "react";
import Link from "next/link";
import { ChevronRight, ArrowUpDown } from "lucide-react";
import { cn, Card, thCls, tdCls, tdNumCls, theadRowCls, trCls } from "@/components/ui";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right";
  priority?: "always" | "md" | "lg" | "xl"; // when the column becomes visible
  cardLabel?: string;       // label used in the mobile card fallback
  titleInCard?: boolean;    // render as the card's title line
  sortKey?: string;         // enables a sortable header linking via sortHref
};

const VIS: Record<NonNullable<Column<unknown>["priority"]>, string> = {
  always: "", md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell",
};

export function DataTable<T>({
  rows, columns, rowKey, href, empty, sort, sortHref,
}: {
  rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string;
  href?: (row: T) => string; empty: React.ReactNode;
  sort?: { key: string; dir: "asc" | "desc" }; sortHref?: (key: string) => string;
}) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <>
      {/* Desktop / tablet: real table, priority-hidden columns, no horizontal scroll */}
      <table className="hidden w-full text-sm sm:table">
        <thead>
          <tr className={theadRowCls}>
            {columns.map((c) => (
              <th key={c.key} className={cn(thCls, c.align === "right" && "text-right", VIS[c.priority ?? "always"])}>
                {c.sortKey && sortHref ? (
                  <Link href={sortHref(c.sortKey)} className="inline-flex items-center gap-1 hover:text-slate-700"
                        aria-sort={sort?.key === c.sortKey ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                    {c.header}<ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </Link>
                ) : c.header}
              </th>
            ))}
            {href && <th className={cn(thCls, "w-10")} aria-hidden="true" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const k = rowKey(row);
            return (
              <tr key={k} className={trCls}>
                {columns.map((c) => (
                  // trCls sets `group relative` on the <tr>, which is what lets the
                  // RowLinkOverlay below stretch to fill the row as a click target.
                  // Cells that render their OWN links/actions (e.g. an EntityLink
                  // cell) must add `relative z-10` so they sit above the overlay
                  // and stay independently clickable/focusable.
                  <td key={c.key} className={cn(c.align === "right" ? tdNumCls : tdCls, VIS[c.priority ?? "always"])}>
                    {href ? <RowLinkOverlay href={href(row)} label="Open" first={c === columns[0]} /> : null}
                    {c.cell(row)}
                  </td>
                ))}
                {href && (
                  <td className={cn(tdCls, "w-10 text-right")}>
                    <Link href={href(row)} className="text-slate-300 group-hover:text-brand-500" aria-label="Open"><ChevronRight className="h-4 w-4" /></Link>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile: card list from the same columns */}
      <ul className="space-y-2 sm:hidden">
        {rows.map((row) => {
          const title = columns.find((c) => c.titleInCard) ?? columns[0];
          const rest = columns.filter((c) => c !== title && c.cardLabel);
          const body = (
            // Whole-card tap target via a STRETCHED overlay link (a sibling of the
            // content, not a wrapper) so a cell's own link (EntityLink, at `relative
            // z-10`) is never nested inside it — nested <a> is invalid HTML.
            <Card className="relative p-4">
              {href && (
                <Link
                  href={href(row)}
                  aria-label="Open"
                  tabIndex={-1}
                  className="absolute inset-0 z-0"
                />
              )}
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">{title.cell(row)}</div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {rest.map((c) => (
                  // Plain cells stay BELOW the overlay so a tap on them navigates via
                  // the stretched link; a cell needing its own click keeps `relative
                  // z-10` inside its `cell` (column config), same as the desktop table.
                  <div key={c.key} className="min-w-0">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{c.cardLabel}</dt>
                    <dd className="truncate text-sm text-slate-700">{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          );
          return <li key={rowKey(row)}>{body}</li>;
        })}
      </ul>
    </>
  );
}

// Full-row click target: a stretched link behind the first cell (keyboard-focusable).
function RowLinkOverlay({ href, label, first }: { href: string; label: string; first: boolean }) {
  if (!first) return null;
  return <Link href={href} aria-label={label} className="absolute inset-0 z-0" tabIndex={-1} />;
}

export function TableScroll({ ariaLabel, children }: { ariaLabel: string; children: React.ReactNode }) {
  return (
    <div role="region" aria-label={ariaLabel} tabIndex={0}
         className="tablescroll overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
      {children}
    </div>
  );
}
