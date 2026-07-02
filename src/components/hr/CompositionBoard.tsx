"use client";

import { MapPin, Briefcase, Layers, Clock, Users } from "lucide-react";
import { useState } from "react";
import { Card, CardHeader, CardBody, EmptyState } from "@/components/ui";
import { BarList } from "@/components/Charts";
import Segmented from "@/components/Segmented";

type Bar = { label: string; count: number };
type Dim = "location" | "designation" | "category" | "tenure";

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
  const max = Math.max(1, ...data.map((b) => b.count));

  return (
    <Card>
      <CardHeader title="Workforce composition" subtitle="Active headcount" />
      <CardBody>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
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
          // ONE representation: the linked horizontal bar list (scales to any n,
          // rows deep-link into the filtered employees list). The gradient column
          // chart that used to sit beside it duplicated the same numbers and read
          // as sparse islands at small n. Width-capped so 2-3 rows don't stretch
          // into absurdly wide bars on large screens.
          <div className="max-w-2xl">
            <BarList items={data.map((b) => ({ label: b.label, value: b.count, max, href: hrefFor(dim, b.label) }))} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
