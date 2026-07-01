"use client";
import { useMemo, useState } from "react";
import { Wallet, Users, CalendarCheck, Plane, FolderKanban } from "lucide-react";
import Segmented from "@/components/Segmented";
import { AreaChart, ForecastArea, BarList } from "@/components/Charts";
import { Card, CardHeader, CardBody, EmptyState } from "@/components/ui";

type Point = { label: string; value: number; forecast?: boolean };
type Bar = { label: string; count: number; href?: string };

export type TrendSeries = {
  payroll: Point[];       // 12 actual + forecast tail (forecast:true)
  headcount: Point[];     // 12 actual + 1 forecast
  attendance: Point[];    // 12 actual (no forecast)
  leave: Point[];         // 12 actual (no forecast)
  projects: Bar[];        // current allocation per project
};

type Metric = "payroll" | "headcount" | "attendance" | "leave" | "projects";
type Range = "6" | "12";

const METRICS = [
  { value: "payroll" as Metric, label: "Payroll", icon: <Wallet className="h-4 w-4" /> },
  { value: "headcount" as Metric, label: "Headcount", icon: <Users className="h-4 w-4" /> },
  { value: "attendance" as Metric, label: "Attendance", icon: <CalendarCheck className="h-4 w-4" /> },
  { value: "leave" as Metric, label: "Leave", icon: <Plane className="h-4 w-4" /> },
  { value: "projects" as Metric, label: "Projects", icon: <FolderKanban className="h-4 w-4" /> },
];

// Keep the last N actual points + all forecast points.
function windowed(points: Point[], n: number): Point[] {
  const actual = points.filter((p) => !p.forecast);
  const forecast = points.filter((p) => p.forecast);
  return [...actual.slice(-n), ...forecast];
}

const SUBTITLE: Record<Metric, string> = {
  payroll: "Net payable per month (solid) · projection (dashed)",
  headcount: "Active staff at each month-end · next month projected",
  attendance: "Monthly present-equivalent %",
  leave: "Leave + sick days taken per month",
  projects: "Active assignments per project (today)",
};

export default function TrendBoard({ series }: { series: TrendSeries }) {
  const [metric, setMetric] = useState<Metric>("payroll");
  const [range, setRange] = useState<Range>("6");
  const n = range === "6" ? 6 : 12;

  const payroll = useMemo(() => windowed(series.payroll, n), [series.payroll, n]);
  const headcount = useMemo(() => windowed(series.headcount, n), [series.headcount, n]);
  const attendance = useMemo(() => windowed(series.attendance, n), [series.attendance, n]);
  const leave = useMemo(() => windowed(series.leave, n), [series.leave, n]);

  return (
    <Card>
      <CardHeader
        title="Trends"
        subtitle={SUBTITLE[metric]}
        action={
          metric !== "projects" ? (
            <Segmented<Range>
              ariaLabel="Time range"
              size="sm"
              value={range}
              onChange={setRange}
              options={[{ value: "6", label: "6 mo" }, { value: "12", label: "12 mo" }]}
            />
          ) : null
        }
      />
      <CardBody className="space-y-4">
        <Segmented<Metric> ariaLabel="Metric" value={metric} onChange={setMetric} options={METRICS} />
        {metric === "payroll" && <ForecastArea data={payroll} idPrefix="tb-pay" />}
        {metric === "headcount" && <ForecastArea data={headcount} idPrefix="tb-head" />}
        {metric === "attendance" && <AreaChart data={attendance} ariaLabel="Monthly attendance rate" />}
        {metric === "leave" && <AreaChart data={leave} ariaLabel="Leave and sick days taken per month" />}
        {metric === "projects" && (
          series.projects.length === 0 ? (
            <EmptyState
              icon={<FolderKanban className="h-6 w-6" />}
              title="No active projects"
              description="Assign employees to a project to see allocation trends here."
            />
          ) : (
            <BarList items={series.projects.map((p) => ({ label: p.label, value: p.count, href: p.href }))} />
          )
        )}
      </CardBody>
    </Card>
  );
}
