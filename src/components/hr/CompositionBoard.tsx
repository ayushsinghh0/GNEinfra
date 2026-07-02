"use client";

import { MapPin, Briefcase, Layers, Clock, Users } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardBody, EmptyState, cn } from "@/components/ui";
import { SegmentDonut, DISTRIBUTION_COLORS } from "@/components/Charts";
import Segmented from "@/components/Segmented";

type Bar = { label: string; count: number };
type Dim = "location" | "designation" | "category" | "tenure";

// The legend list is capped so the card doesn't sprawl past what a glance can absorb.
// The donut itself is NEVER capped — it's built from the full `data` array so its arcs
// always sum to the true 100%, even when the tail beyond ROW_CAP is collapsed to "+N more"
// in the list below.
const ROW_CAP = 8;

const OPTIONS = [
  { value: "location" as Dim, label: "Location", icon: <MapPin className="h-3.5 w-3.5" /> },
  { value: "designation" as Dim, label: "Designation", icon: <Briefcase className="h-3.5 w-3.5" /> },
  { value: "category" as Dim, label: "Category", icon: <Layers className="h-3.5 w-3.5" /> },
  { value: "tenure" as Dim, label: "Tenure", icon: <Clock className="h-3.5 w-3.5" /> },
];

// Deep-link a bar into the employees list filtered on that dimension. "—"
// stands for a null/unset value on the employee record — there's no way to
// query for that via the exact-match filter, so leave it non-linked rather
// than producing a link that returns zero results. Tenure buckets are a
// derived calculation (not a stored field), so employees can't be filtered
// by them — also left non-linked.
function hrefFor(dim: Dim, label: string): string | undefined {
  if (label === "—") return undefined;
  if (dim === "location") return `/hr/employees?location=${encodeURIComponent(label)}`;
  if (dim === "category") return `/hr/employees?category=${encodeURIComponent(label)}`;
  if (dim === "designation") return `/hr/employees?q=${encodeURIComponent(label)}`;
  return undefined;
}

export default function CompositionBoard({
  location,
  designation,
  category,
  tenure,
}: {
  location: Bar[];
  designation: Bar[];
  category: Bar[];
  tenure: Bar[];
}) {
  const [dim, setDim] = useState<Dim>("location");
  const all = { location, designation, category, tenure }[dim];
  // Tenure buckets have a meaningful order; the others read best ranked by size.
  const data = dim === "tenure" ? all : [...all].sort((a, b) => b.count - a.count);
  const total = data.reduce((s, b) => s + b.count, 0);

  return (
    <Card className="h-full">
      <CardHeader title="Workforce composition" subtitle="Active headcount" />
      <CardBody className="px-6 py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Segmented
            ariaLabel="Composition dimension"
            options={OPTIONS}
            value={dim}
            onChange={setDim}
            size="sm"
          />
          <span className="text-xs text-slate-400">
            by {dim} · <span className="nums">{total}</span> active
          </span>
        </div>
        {data.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No composition data yet"
            description="Once active employees are on record, their breakdown by this dimension will appear here."
          />
        ) : (
          // ONE composed visualization, not three renders of the same numbers: the donut's
          // arcs are the ONLY place proportion is shown (no bar, no second legend), and the
          // list beside it is the ONLY place exact counts/percentages are printed. Dot color
          // (list) and arc color (donut) share one index into DISTRIBUTION_COLORS/
          // DISTRIBUTION_STROKES, fed by the same sorted `data` array, so they always agree.
          <div className="grid items-center gap-8 sm:grid-cols-[auto_1fr]">
            <div className="flex justify-center sm:justify-start">
              <SegmentDonut
                segments={data.map((b) => ({ label: b.label, value: b.count }))}
                centerValue={total}
                centerLabel="active"
              />
            </div>
            <div>
              <ul className="space-y-1">
                {data.slice(0, ROW_CAP).map((b, i) => {
                  const pct = total ? Math.round((b.count / total) * 100) : 0;
                  const href = hrefFor(dim, b.label);
                  const dotCls = DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length];
                  const inner = (
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dotCls)} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-600 group-hover:text-brand-700">{b.label}</span>
                      <span className="nums shrink-0 text-sm font-semibold text-slate-700">{b.count}</span>
                      <span className="nums w-9 shrink-0 text-right text-xs text-slate-400">{pct}%</span>
                    </div>
                  );
                  return (
                    <li key={b.label}>
                      {href ? (
                        <Link
                          href={href}
                          className="group -mx-1.5 flex min-h-9 items-center rounded-lg px-1.5 motion-safe:transition-colors hover:bg-slate-50"
                        >
                          {inner}
                        </Link>
                      ) : (
                        <div className="flex min-h-9 items-center px-1.5">{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {data.length > ROW_CAP && (
                <p className="mt-2 px-1.5 text-xs text-slate-400">+{data.length - ROW_CAP} more</p>
              )}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
