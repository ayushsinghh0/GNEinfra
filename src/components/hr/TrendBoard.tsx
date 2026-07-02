"use client";
import { useMemo, useState } from "react";
import { Wallet, Users, CalendarCheck, Plane } from "lucide-react";
import Segmented from "@/components/Segmented";
import { AreaChart, ForecastArea, Sparkline } from "@/components/Charts";
import { Card, CardHeader, CardBody, cn } from "@/components/ui";
import { fmtINR } from "@/lib/format";

type Point = { label: string; value: number; forecast?: boolean };

// Time-series metrics only. Project allocation is NOT a trend — it lives in the
// "Project utilization" card (DashboardComposition), its single home; a Projects
// tab here used to duplicate that card's exact bars.
export type TrendSeries = {
  payroll: Point[];       // 12 actual + forecast tail (forecast:true)
  headcount: Point[];     // 12 actual + 1 forecast
  attendance: Point[];    // 12 actual (no forecast)
  leave: Point[];         // 12 actual (no forecast)
};

type Metric = "payroll" | "headcount" | "attendance" | "leave";
type Range = "6" | "12";

const METRICS = [
  { value: "payroll" as Metric, label: "Payroll", icon: <Wallet className="h-3.5 w-3.5" /> },
  { value: "headcount" as Metric, label: "Headcount", icon: <Users className="h-3.5 w-3.5" /> },
  { value: "attendance" as Metric, label: "Attendance", icon: <CalendarCheck className="h-3.5 w-3.5" /> },
  { value: "leave" as Metric, label: "Leave", icon: <Plane className="h-3.5 w-3.5" /> },
];

// Keep the last N actual points + all forecast points — feeds the big chart below.
function windowed(points: Point[], n: number): Point[] {
  const actual = points.filter((p) => !p.forecast);
  const forecast = points.filter((p) => p.forecast);
  return [...actual.slice(-n), ...forecast];
}

// Actual (non-forecast) values only, in series order — feeds both the mini
// stat-tab's "current value" (its last element) and its inline sparkline
// (the whole array). Deliberately independent of the big chart's 6/12mo
// range toggle so the tab strip stays stable while the user flips ranges.
function actualValues(points: Point[]): number[] {
  return points.filter((p) => !p.forecast).map((p) => p.value);
}

const SUBTITLE: Record<Metric, string> = {
  payroll: "Net payable per month (solid) · projection (dashed)",
  headcount: "Active staff at each month-end · next month projected",
  attendance: "Monthly present-equivalent %",
  leave: "Leave + sick days taken per month",
};

export default function TrendBoard({ series }: { series: TrendSeries }) {
  const [metric, setMetric] = useState<Metric>("payroll");
  const [range, setRange] = useState<Range>("6");
  const n = range === "6" ? 6 : 12;

  const payroll = useMemo(() => windowed(series.payroll, n), [series.payroll, n]);
  const headcount = useMemo(() => windowed(series.headcount, n), [series.headcount, n]);
  const attendance = useMemo(() => windowed(series.attendance, n), [series.attendance, n]);
  const leave = useMemo(() => windowed(series.leave, n), [series.leave, n]);

  const sparkData: Record<Metric, number[]> = useMemo(
    () => ({
      payroll: actualValues(series.payroll),
      headcount: actualValues(series.headcount),
      attendance: series.attendance.map((p) => p.value),
      leave: series.leave.map((p) => p.value),
    }),
    [series]
  );

  // "Current" = last actual (non-forecast) point per metric — the same rule
  // the big chart's forecast tail already anchors on, just surfaced as a
  // scalar. Real data only, never the forecast value.
  const currentValue: Record<Metric, string> = {
    payroll: fmtINR(sparkData.payroll.at(-1) ?? 0),
    headcount: String(sparkData.headcount.at(-1) ?? 0),
    attendance: `${sparkData.attendance.at(-1) ?? 0}%`,
    leave: `${sparkData.leave.at(-1) ?? 0}d`,
  };

  // Forecast-capable metrics only — payroll/headcount are the only two series
  // that ever carry a dashed projection segment (attendance/leave are actuals
  // only), so the legend is only meaningful there.
  const showLegend = metric === "payroll" || metric === "headcount";

  return (
    <Card>
      <CardHeader
        title="Trends"
        subtitle={SUBTITLE[metric]}
        action={
          <Segmented<Range>
            ariaLabel="Time range"
            size="sm"
            value={range}
            onChange={setRange}
            options={[{ value: "6", label: "6 mo" }, { value: "12", label: "12 mo" }]}
          />
        }
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Metric">
          {METRICS.map((m) => {
            const selected = metric === m.value;
            return (
              <button
                key={m.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setMetric(m.value)}
                className={cn(
                  "flex flex-col gap-1.5 rounded-xl border p-3 text-left motion-safe:transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                  selected
                    ? "border-brand-300 bg-brand-50/70 ring-2 ring-brand-500/25"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <span className={cn("flex items-center gap-1.5 text-[11px] font-medium", selected ? "text-brand-700" : "text-slate-500")}>
                  {m.icon}
                  {m.label}
                </span>
                <span className="nums text-base font-semibold leading-none text-slate-900 sm:text-lg">
                  {currentValue[m.value]}
                </span>
                <Sparkline
                  data={sparkData[m.value]}
                  className={cn("h-5 w-full", selected ? "text-brand-600" : "text-slate-300")}
                />
              </button>
            );
          })}
        </div>

        {metric === "payroll" && <ForecastArea data={payroll} idPrefix="tb-pay" />}
        {metric === "headcount" && <ForecastArea data={headcount} idPrefix="tb-head" />}
        {metric === "attendance" && <AreaChart data={attendance} ariaLabel="Monthly attendance rate" />}
        {metric === "leave" && <AreaChart data={leave} ariaLabel="Leave and sick days taken per month" />}

        {showLegend && (
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
              actual
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0 w-3 border-t-2 border-dashed border-slate-400" aria-hidden="true" />
              projected
            </span>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
