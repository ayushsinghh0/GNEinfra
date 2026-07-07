// Dependency-free, server-rendered charts (SVG + CSS only) — no client JS, no
// chart library: keeps the bundle and server light while staying fully bespoke
// and on-brand. All motion is CSS and gated on prefers-reduced-motion.

import Link from "next/link";
import { cn } from "@/components/ui";

/* ── Smooth area + line trend ───────────────────────────────────────────── */
function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const mx = (p0.x + p1.x) / 2;
    d += ` C${mx},${p0.y} ${mx},${p1.y} ${p1.x},${p1.y}`;
  }
  return d;
}

export function AreaChart({
  data,
  ariaLabel = "Trend chart",
}: {
  data: { label: string; value: number }[];
  ariaLabel?: string;
}) {
  // Wide, flat viewBox (~4.8:1). The svg renders at the card's full width, so the
  // viewBox scale factor is what sizes text/strokes on screen: at 560 units wide a
  // ~1500px card scaled everything 2.7× (cartoonishly large labels, a 600px-tall
  // chart). 1000 units keeps fonts near-native and the chart a sane height.
  const W = 1000;
  const H = 210;
  const pad = { l: 10, r: 10, t: 16, b: 26 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const dataMax = Math.max(0, ...data.map((d) => d.value));
  const allZero = data.length > 0 && dataMax === 0;
  // 15% headroom above the tallest point so its value label (rendered above the point)
  // never brushes — let alone clips against — the viewBox's top edge.
  const scaleMax = Math.max(1, dataMax * 1.15);
  const baseY = pad.t + innerH;
  // No live width to measure (server-rendered SVG) — thin x-axis labels deterministically
  // once there are enough points to collide (e.g. a 12-month window) rather than at every
  // point, which crowds narrow viewports. The last point's label always stays so the most
  // recent period is never hidden.
  const labelStep = data.length > 8 ? 2 : 1;

  const pts = data.map((d, i) => {
    const x = pad.l + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const y = pad.t + innerH - (d.value / scaleMax) * innerH;
    return { x, y, ...d };
  });

  const line = smoothPath(pts);
  const area = pts.length
    ? `${line} L${pts[pts.length - 1].x},${baseY} L${pts[0].x},${baseY} Z`
    : "";

  // 4 horizontal gridlines.
  const grids = [0, 0.25, 0.5, 0.75].map((f) => pad.t + innerH * f);

  // Declutter: label only the first, max (first occurrence), and last point instead of
  // every point — a flat/near-flat series no longer prints a value under each dot.
  const maxIdx = data.findIndex((d) => d.value === dataMax);
  const labeledIdx = new Set([0, maxIdx, data.length - 1].filter((i) => i >= 0));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="areaLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0d9488" />
          <stop offset="100%" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>

      {grids.map((y, i) => (
        <line key={i} x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#eef2f6" strokeWidth="1" />
      ))}
      <line x1={pad.l} y1={baseY} x2={W - pad.r} y2={baseY} stroke="#e2e8f0" strokeWidth="1" />

      {allZero && (
        <text x={W / 2} y={pad.t + innerH / 2} textAnchor="middle" dominantBaseline="middle" fontSize="13" fill="#94a3b8">
          No data in this range
        </text>
      )}

      {!allZero && area && <path className="animate-fade-up" d={area} fill="url(#areaFill)" />}
      {!allZero && line && (
        <path
          className="draw-line"
          d={line}
          fill="none"
          stroke="url(#areaLine)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
        />
      )}

      {pts.map((p, i) => (
        <g key={i}>
          {/* Persistent value label — visible on touch/keyboard/everyone (no hover-only).
              Declutter: only the first/max/last point is labeled (see labeledIdx above);
              an all-zero series renders no line/points/labels at all (see allZero above). */}
          {!allZero && labeledIdx.has(i) && (
            <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f766e" className="nums">
              {p.value}
            </text>
          )}
          {!allZero && <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="#0d9488" strokeWidth="2" />}
          {(i % labelStep === 0 || i === pts.length - 1) && (
            <text x={p.x} y={H - 8} textAnchor="middle" fontSize="11" fill="#64748b">
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/* ── Trend + forecast area (actuals solid, forecast dashed) ─────────────── */
export function ForecastArea({
  data, idPrefix = "fc",
}: {
  data: { label: string; value: number; forecast?: boolean }[];
  idPrefix?: string;
}) {
  // Same wide-flat viewBox rationale as AreaChart (see comment there).
  const W = 1000, H = 220;
  const pad = { l: 12, r: 12, t: 20, b: 28 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const dataMax = Math.max(0, ...data.map((d) => d.value));
  // Same 15% headroom rationale as AreaChart, kept even though this chart doesn't
  // currently print per-point values — the drawn curve itself shouldn't hug the top edge.
  const scaleMax = Math.max(1, dataMax * 1.15);
  const baseY = pad.t + innerH;
  const pts = data.map((d, i) => ({
    x: pad.l + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW),
    y: pad.t + innerH - (d.value / scaleMax) * innerH,
    label: d.label, value: d.value, forecast: !!d.forecast,
  }));

  const fi = pts.findIndex((p) => p.forecast);
  const actual = fi === -1 ? pts : pts.slice(0, fi);
  const allZero = actual.length > 0 && actual.every((p) => p.value === 0);

  // Projection sanity: a least-squares dashed forecast is misleading (and was observed
  // swinging wildly after a dip) when there isn't enough real signal to trust it, or when
  // it disagrees violently with the last actual. Suppress the dashed segment in that case
  // and render actuals only.
  const lastActual = actual[actual.length - 1];
  const nonZeroActualCount = actual.filter((p) => p.value !== 0).length;
  const firstForecastPt = fi === -1 ? undefined : pts[fi];
  const earlierNonZero = actual.slice(0, -1).some((p) => p.value !== 0);
  const isPartialPeriodCliff = !!lastActual && lastActual.value === 0 && earlierNonZero;
  const deviatesFromLastActual =
    !!firstForecastPt && !!lastActual && lastActual.value !== 0 &&
    Math.abs(firstForecastPt.value - lastActual.value) > 2 * Math.abs(lastActual.value);
  const suppressForecast =
    allZero ||
    fi === -1 ||
    nonZeroActualCount < 3 ||
    isPartialPeriodCliff ||
    deviatesFromLastActual ||
    (!!firstForecastPt && firstForecastPt.value < 0);

  // Points actually rendered — actuals only when the forecast is suppressed, so no
  // forecast dots/labels/divider linger once the dashed line itself is gone.
  const visible = suppressForecast ? actual : pts;
  // Same deterministic label-thinning as AreaChart — the headcount series runs up to
  // 13 points (12 actual + forecast tail) and collide on narrow viewports otherwise.
  const labelStep = visible.length > 8 ? 2 : 1;

  const actualLine = smoothPath(actual);
  const actualArea = actual.length
    ? `${actualLine} L${actual[actual.length - 1].x},${baseY} L${actual[0].x},${baseY} Z`
    : "";
  const forecast = !suppressForecast && fi !== -1 ? pts.slice(Math.max(0, fi - 1)) : []; // start at last actual to connect
  const forecastLine = smoothPath(forecast);
  const grids = [0, 0.25, 0.5, 0.75].map((f) => pad.t + innerH * f);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Trend with forecast">
      <defs>
        <linearGradient id={`${idPrefix}Fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${idPrefix}Line`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0d9488" />
          <stop offset="100%" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>
      {grids.map((y, i) => (
        <line key={i} x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#eef2f6" strokeWidth="1" />
      ))}
      <line x1={pad.l} y1={baseY} x2={W - pad.r} y2={baseY} stroke="#e2e8f0" strokeWidth="1" />

      {allZero && (
        <text x={W / 2} y={pad.t + innerH / 2} textAnchor="middle" dominantBaseline="middle" fontSize="13" fill="#94a3b8">
          No data in this range
        </text>
      )}

      {!allZero && actualArea && <path className="animate-fade-up" d={actualArea} fill={`url(#${idPrefix}Fill)`} />}
      {!allZero && actualLine && (
        <path d={actualLine} fill="none" stroke={`url(#${idPrefix}Line)`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {!allZero && !suppressForecast && forecastLine && (
        <path d={forecastLine} fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {!allZero && !suppressForecast && fi > 0 && (
        <line x1={pts[fi - 1].x} y1={pad.t} x2={pts[fi - 1].x} y2={baseY} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
      )}
      {visible.map((p, i) => (
        <g key={i}>
          {!allZero && <circle cx={p.x} cy={p.y} r="3" fill="#fff" stroke={p.forecast ? "#94a3b8" : "#0d9488"} strokeWidth="2" />}
          {(i % labelStep === 0 || i === visible.length - 1) && (
            <text x={p.x} y={H - 8} textAnchor="middle" fontSize="11" fill={p.forecast ? "#94a3b8" : "#64748b"}>
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/* ── Sparkline (tiny inline trend line for stat-tab cards) ────────────────
   Minimal ~72×20 polyline — stroke currentColor (inherits the caller's text
   color via a Tailwind text-* class), no dots/gridlines/labels. Purely
   decorative next to a real numeric value, so it's aria-hidden. */
export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length === 0) return null;
  const W = 72, H = 20, pad = 2;
  const innerW = W - pad * 2, innerH = H - pad * 2;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = pad + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
      const y = pad + innerH - ((v - min) / range) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("block", className)} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Delta badge (period-over-period change) ────────────────────────────── */
export function DeltaBadge({ value, invert }: { value: number | null; invert?: boolean }) {
  if (value === null || !Number.isFinite(value)) {
    return (
      <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-400">
        —
      </span>
    );
  }
  const rounded = Math.round(value);
  const up = value >= 0;
  const good = invert ? !up : up;
  const cls =
    rounded === 0 ? "bg-slate-100 text-slate-500" : good ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600";
  const arrow = rounded === 0 ? "" : up ? "▲" : "▼";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {arrow} {up ? "+" : ""}{rounded}%
    </span>
  );
}

/* ── Status donut ───────────────────────────────────────────────────────── */
const STATUS_COLOR: Record<string, string> = {
  SUBMITTED: "#3b82f6",
  UNDER_REVIEW: "#f59e0b",
  APPROVED: "#10b981",
  REJECTED: "#f43f5e",
  // BD pipeline stages / outcomes (match src/lib/hr-status.ts tones)
  ENQUIRY: "#0ea5e9",
  QUOTE_SUBMITTED: "#8b5cf6",
  FOLLOW_UP: "#3b82f6",
  NEGOTIATION: "#f59e0b",
  CLOSED: "#94a3b8",
  OPEN: "#0ea5e9",
  WON: "#10b981",
  LOST: "#f43f5e",
  // Finance invoice workflow
  DRAFT: "#94a3b8",
  PENDING_APPROVAL: "#f59e0b",
  UNPAID: "#f59e0b",
  PAID: "#10b981",
};

export function Donut({
  data,
  unitLabel = "vendors",
}: {
  data: { label: string; status: string; value: number }[];
  unitLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 52;
  const C = 2 * Math.PI * r;
  let acc = 0;
  const segs = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const frac = d.value / (total || 1);
      const seg = {
        status: d.status,
        len: frac * C,
        offset: -acc * C,
        color: STATUS_COLOR[d.status] ?? "#94a3b8",
      };
      acc += frac;
      return seg;
    });

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
      <div className="relative shrink-0">
        <svg viewBox="0 0 140 140" className="animate-fade-up h-36 w-36 -rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="15" />
          {total > 0 &&
            segs.map((s) => (
              <circle
                key={s.status}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="15"
                strokeLinecap="round"
                strokeDasharray={`${Math.max(0, s.len - 3)} ${C - Math.max(0, s.len - 3)}`}
                strokeDashoffset={s.offset}
              />
            ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <div className="nums text-2xl font-bold leading-none text-slate-900">{total}</div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-400">{unitLabel}</div>
        </div>
      </div>

      {/* `w-full` in the mobile stack; in the sm+ row layout it must be a
          shrinkable flex child (flex-1 + min-w-0) so it fills the space beside
          the fixed-width donut instead of forcing 100% and overflowing. */}
      <ul className="w-full space-y-2 sm:min-w-0 sm:flex-1">
        {data.map((d) => {
          const pct = total ? Math.round((d.value / total) * 100) : 0;
          return (
            <li key={d.status} className="flex min-w-0 items-center gap-2.5 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: STATUS_COLOR[d.status] ?? "#94a3b8" }}
              />
              <span className="min-w-0 truncate text-slate-600">{d.label}</span>
              <span className="nums ml-auto shrink-0 font-semibold text-slate-700">{d.value}</span>
              <span className="nums w-9 shrink-0 text-right text-xs text-slate-400">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Legacy bar chart (kept for reuse) ──────────────────────────────────── */
export function MonthlyBars({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const allZero = data.length > 0 && data.every((d) => d.value === 0);
  // Same deterministic thinning as the SVG charts, for consistency if this is ever fed a
  // longer (e.g. 12-month) series — each bar's column is fixed-width and truncates its own
  // label, so collisions aren't the everyday case, but a real zero still needs to read as
  // "0" rather than a blank cell.
  const labelStep = data.length > 8 ? 2 : 1;

  if (allZero) {
    return (
      <div className="flex h-44 items-center justify-center border-b border-slate-100">
        <span className="text-sm text-slate-400">No data in this range</span>
      </div>
    );
  }

  // Bars are capped (max-w-16 column / max-w-12 bar) and the row is centered, so a small
  // category count (n≤6) reads as an intentional, clustered mini-chart instead of a few
  // skinny bars stretched across the full card width with huge gaps between them.
  return (
    <div className="flex h-44 items-end justify-center gap-3">
      {data.map((d, i) => (
        <div key={i} className="flex h-full min-w-0 max-w-16 flex-1 flex-col items-center justify-end gap-1.5">
          <span className="nums text-[11px] font-semibold text-slate-600">{d.value}</span>
          <div
            className="grow-bar w-full max-w-12 rounded-t-md bg-gradient-to-t from-brand-600 to-brand-300"
            style={{
              height: `${d.value > 0 ? Math.max((d.value / max) * 100, 4) : 0}%`,
              animationDelay: `${i * 60}ms`,
            }}
          />
          <span className="w-full truncate text-center text-[11px] text-slate-400" title={d.label}>
            {i % labelStep === 0 || i === data.length - 1 ? d.label : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

const STATUS_BAR: Record<string, string> = {
  SUBMITTED: "bg-blue-500",
  UNDER_REVIEW: "bg-amber-500",
  APPROVED: "bg-emerald-500",
  REJECTED: "bg-rose-500",
};

export function StatusBars({
  data,
}: {
  data: { label: string; status: string; value: number }[];
}) {
  const total = Math.max(1, data.reduce((s, d) => s + d.value, 0));
  return (
    <div className="space-y-3.5">
      {data.map((d) => (
        <div key={d.status}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-slate-600">{d.label}</span>
            <span className="nums font-medium text-slate-700">{d.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-2 rounded-full ${STATUS_BAR[d.status] ?? "bg-slate-400"}`}
              style={{ width: `${(d.value / total) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Bar list (shared horizontal label + count + gradient progress bar) ──
   Single source of truth for the three call sites that used to hand-roll
   this (HR dashboard, CompositionBoard, TrendBoard). Rows are optionally
   linkable — pass `href` to deep-link a bar into a filtered list. */
export function BarList({
  items,
  formatValue,
}: {
  items: { label: string; value: number; max?: number; href?: string }[];
  /** Optional value renderer (e.g. fmtINR for money bars); defaults to the raw number. */
  formatValue?: (n: number) => string;
}) {
  if (items.length === 0) return null;
  const maxOfItems = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const denom = item.max ?? maxOfItems;
        const pct = denom ? Math.min(100, (item.value / denom) * 100) : 0;
        const row = (
          <>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="truncate text-slate-600">{item.label}</span>
              <span className="nums ml-2 font-medium text-slate-700">
                {formatValue ? formatValue(item.value) : item.value}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        );
        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className="-mx-1.5 block rounded-lg px-1.5 py-0.5 motion-safe:transition-colors hover:bg-slate-50"
          >
            {row}
          </Link>
        ) : (
          <div key={item.label}>{row}</div>
        );
      })}
    </div>
  );
}

/* ── Ring gauge (bespoke SVG donut-style % ring) ──────────────────────────
   Generic, reusable — a background track + a rounded-linecap arc for `value`%,
   with the percentage centered in the ring and a label/sublabel beneath. Tone
   maps to STATIC stroke/fill class lists (Tailwind can't see interpolated
   class names), so every tone this component supports must be listed in both
   maps below. Pure SVG + CSS (no client JS) so it stays server-renderable. */
export type RingTone = "brand" | "amber" | "emerald" | "sky" | "violet" | "rose";

const RING_STROKE: Record<RingTone, string> = {
  brand: "stroke-brand-500",
  amber: "stroke-amber-500",
  emerald: "stroke-emerald-500",
  sky: "stroke-sky-500",
  violet: "stroke-violet-500",
  rose: "stroke-rose-500",
};

// Text tone one step darker than the stroke for contrast/legibility, mirroring
// the darkness convention StatCard's STAT_TONES already uses (700 for brand,
// 600 for the rest).
const RING_FILL: Record<RingTone, string> = {
  brand: "fill-brand-700",
  amber: "fill-amber-600",
  emerald: "fill-emerald-600",
  sky: "fill-sky-600",
  violet: "fill-violet-600",
  rose: "fill-rose-600",
};

export function RingGauge({
  value,
  label,
  sublabel,
  tone = "brand",
  size = 96,
}: {
  value: number; // 0–100
  label: string;
  sublabel?: string;
  tone?: RingTone;
  size?: number; // px
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const strokeW = 10;
  const r = 50 - strokeW / 2;
  const C = 2 * Math.PI * r;
  const dash = (v / 100) * C;

  return (
    // min-width (not fixed width): the label column may run wider than the
    // ring so short sublabels ("5 of 6 active staff") stay on one line.
    <div className="flex flex-col items-center text-center" style={{ minWidth: size, maxWidth: size * 2 }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${label}: ${v}%`}>
        {/* Rotate just the ring geometry (not the text) so the arc starts at 12 o'clock
            while the center label stays upright. */}
        <g transform="rotate(-90 50 50)">
          <circle cx="50" cy="50" r={r} fill="none" className="stroke-slate-100" strokeWidth={strokeW} />
          {v > 0 && (
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              strokeWidth={strokeW}
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C - dash}
              className={cn(
                RING_STROKE[tone],
                "motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700 motion-safe:ease-out motion-reduce:transition-none"
              )}
            />
          )}
        </g>
        <text
          x="50"
          y="54"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="22"
          fontWeight="700"
          className={cn("nums", RING_FILL[tone])}
        >
          {v}%
        </text>
      </svg>
      <div className="mt-2 text-xs font-semibold text-slate-700">{label}</div>
      {sublabel && <div className="nums text-[11px] text-slate-400">{sublabel}</div>}
    </div>
  );
}

/* ── Distribution bar (segmented 100% bar + color-keyed legend) ──────────
   One horizontal bar sliced proportionally by `segments`, plus a wrapping
   legend below with a color dot + label + count + pct per segment. Legend
   items are Link-wrapped (44px tap target) when `href` is given. More than
   DISTRIBUTION_MAX segments collapse the tail into a non-linked "Other"
   bucket so the bar/legend never turn into an unreadable rainbow. */
export type DistributionSegment = { label: string; value: number; href?: string };

// Static, ordered palette shared by the bar fill, the legend dots, and any
// caller-side ranked list that wants matching dot colors (e.g. CompositionBoard's
// detail rows and SegmentDonut's arcs) — two shades per hue (light for the first
// pass through the family, dark for the second) so up to 9 real categories each
// get a genuinely distinct color before repeating. slate-300, now the LAST entry,
// is the color that lands on the grouped "Other" bucket once segments exceed
// DISTRIBUTION_MAX (DistributionBar only — SegmentDonut/CompositionBoard never
// group into "Other", they cycle the palette instead).
export const DISTRIBUTION_COLORS = [
  "bg-brand-500",
  "bg-emerald-400",
  "bg-sky-400",
  "bg-violet-400",
  "bg-amber-400",
  "bg-brand-700",
  "bg-emerald-600",
  "bg-sky-600",
  "bg-violet-600",
  "bg-slate-300",
] as const;

// Stroke-color twin of DISTRIBUTION_COLORS (same order, same index) for SVG arcs
// (SegmentDonut) — Tailwind can't derive a `stroke-*` class from a `bg-*` string,
// so this parallel static list keeps arcs and legend dots pixel-matched by index.
export const DISTRIBUTION_STROKES = [
  "stroke-brand-500",
  "stroke-emerald-400",
  "stroke-sky-400",
  "stroke-violet-400",
  "stroke-amber-400",
  "stroke-brand-700",
  "stroke-emerald-600",
  "stroke-sky-600",
  "stroke-violet-600",
  "stroke-slate-300",
] as const;

const DISTRIBUTION_MAX = 6;

/* ── Segment donut (multi-segment SVG donut + centered total) ────────────
   Generalizes RingGauge's rotate(-90) + stroke-dasharray arc technique from a
   single value to N proportional segments: same track-circle-plus-overlaid-arc
   idea, just one stroked circle per segment, each dasharray'd to its own share
   of the circumference and dashoffset'd to start where the previous one ended.
   Segments are colored by array index from DISTRIBUTION_STROKES so a caller's
   dot-legend (indexed into DISTRIBUTION_COLORS the same way) always matches its
   arc — index parity is why zero-value entries are NOT filtered out before
   mapping (that would shift every later index out of sync with the caller's
   list); they simply contribute a zero-length, invisible arc instead. A single
   real (non-zero) segment renders a seamless full ring (no gap to notch), and
   an empty/all-zero `segments` renders a plain slate-100 track with no arcs at
   all. The whole graphic is one `role="img"` with a summarizing aria-label;
   every part inside (arcs, track, the center value overlay) is aria-hidden so
   nothing is announced twice. */
export function SegmentDonut({
  segments,
  centerValue,
  centerLabel,
  size = 160,
  ariaLabel,
}: {
  segments: { label: string; value: number }[];
  centerValue: string | number;
  centerLabel?: string;
  size?: number; // px
  ariaLabel?: string;
}) {
  const strokeW = 14;
  const r = 50 - strokeW / 2;
  const C = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  // A visible seam only makes sense between two-or-more real slices — one
  // real segment (however many zero-value entries ride along beside it) still
  // reads as a single full ring, and an all-zero set has nothing to seam.
  const positiveCount = segments.filter((s) => s.value > 0).length;
  const gapPx = positiveCount > 1 ? 0.012 * C : 0;

  let acc = 0;
  const arcs = segments.map((s, i) => {
    const frac = total > 0 ? Math.max(0, s.value) / total : 0;
    const len = Math.max(0, frac * C - gapPx);
    const offset = -(acc * C);
    acc += frac;
    return { key: `${s.label}-${i}`, len, offset, cls: DISTRIBUTION_STROKES[i % DISTRIBUTION_STROKES.length] };
  });

  const summary =
    ariaLabel ??
    (total > 0
      ? `${centerLabel ? `${centerLabel} ` : ""}${centerValue} — ${segments
          .filter((s) => s.value > 0)
          .map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`)
          .join(", ")}`
      : `${centerLabel ? `${centerLabel} ` : ""}${centerValue}`);

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={summary}>
        <g transform="rotate(-90 50 50)" aria-hidden="true">
          <circle cx="50" cy="50" r={r} fill="none" className="stroke-slate-100" strokeWidth={strokeW} />
          {total > 0 &&
            arcs.map((a) =>
              a.len > 0 ? (
                <circle
                  key={a.key}
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  strokeWidth={strokeW}
                  strokeLinecap="round"
                  strokeDasharray={`${a.len} ${Math.max(0, C - a.len)}`}
                  strokeDashoffset={a.offset}
                  className={cn(
                    a.cls,
                    "motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700 motion-safe:ease-out motion-reduce:transition-none"
                  )}
                />
              ) : null
            )}
        </g>
      </svg>
      <div
        className="pointer-events-none absolute inset-0 grid place-content-center px-2 text-center"
        aria-hidden="true"
      >
        <div className="nums text-2xl font-semibold leading-none text-slate-900">{centerValue}</div>
        {centerLabel && <div className="mt-1 text-[11px] font-medium text-slate-400">{centerLabel}</div>}
      </div>
    </div>
  );
}

export function DistributionBar({ segments }: { segments: DistributionSegment[] }) {
  const clean = segments.filter((s) => s.value > 0);
  if (clean.length === 0) return null;

  const display: DistributionSegment[] =
    clean.length > DISTRIBUTION_MAX
      ? [
          ...clean.slice(0, DISTRIBUTION_MAX - 1),
          { label: "Other", value: clean.slice(DISTRIBUTION_MAX - 1).reduce((s, x) => s + x.value, 0) },
        ]
      : clean;

  const total = display.reduce((s, x) => s + x.value, 0) || 1;

  return (
    <div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={`Distribution: ${display.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(", ")}`}
      >
        {display.map((seg, i) => {
          const pct = (seg.value / total) * 100;
          return (
            <div
              key={seg.label}
              className={cn(
                "h-full",
                DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length],
                i > 0 && "border-l-2 border-white"
              )}
              style={{ width: `${pct}%` }}
              title={`${seg.label}: ${seg.value} (${Math.round(pct)}%)`}
            />
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {display.map((seg, i) => {
          const pct = Math.round((seg.value / total) * 100);
          const content = (
            <>
              <span
                className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length])}
                aria-hidden="true"
              />
              <span className="truncate text-slate-600 group-hover:text-brand-700">{seg.label}</span>
              <span className="nums font-semibold text-slate-700">{seg.value}</span>
              <span className="nums text-xs text-slate-400">({pct}%)</span>
            </>
          );
          return (
            <li key={seg.label}>
              {seg.href ? (
                <Link
                  href={seg.href}
                  className="group -mx-1.5 flex min-h-11 items-center gap-1.5 rounded-lg px-1.5 text-sm motion-safe:transition-colors hover:bg-slate-50"
                >
                  {content}
                </Link>
              ) : (
                <span className="flex min-h-11 items-center gap-1.5 px-1.5 text-sm">{content}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
