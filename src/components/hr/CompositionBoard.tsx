"use client";

import { useState } from "react";
import { MapPin, Briefcase, Layers, Clock } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui";
import { MonthlyBars } from "@/components/Charts";
import Segmented from "@/components/Segmented";

type Bar = { label: string; count: number };
type Dim = "location" | "designation" | "category" | "tenure";

const OPTIONS = [
  { value: "location" as Dim, label: "Location", icon: <MapPin className="h-3.5 w-3.5" /> },
  { value: "designation" as Dim, label: "Designation", icon: <Briefcase className="h-3.5 w-3.5" /> },
  { value: "category" as Dim, label: "Category", icon: <Layers className="h-3.5 w-3.5" /> },
  { value: "tenure" as Dim, label: "Tenure", icon: <Clock className="h-3.5 w-3.5" /> },
];

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
  const chartData = data.slice(0, 8).map((b) => ({ label: b.label, value: b.count }));

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
          <p className="text-sm text-slate-500">No data yet.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <MonthlyBars data={chartData} />
            <div className="space-y-2.5 lg:border-l lg:border-slate-100 lg:pl-6">
              {data.map((b) => (
                <div key={b.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="truncate text-slate-600">{b.label}</span>
                    <span className="nums ml-2 font-medium text-slate-700">{b.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-brand-500 to-brand-300"
                      style={{ width: `${(b.count / max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
