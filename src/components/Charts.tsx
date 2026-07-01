// Dependency-free, server-rendered charts (SVG + CSS only) — no client JS, no
// chart library: keeps the bundle and server light while staying fully bespoke
// and on-brand. All motion is CSS and gated on prefers-reduced-motion.

import Link from "next/link";

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
  ariaLabel = "New vendor registrations over the last 6 months",
}: {
  data: { label: string; value: number }[];
  ariaLabel?: string;
}) {
  const W = 560;
  const H = 210;
  const pad = { l: 10, r: 10, t: 16, b: 26 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const max = Math.max(1, ...data.map((d) => d.value));
  const baseY = pad.t + innerH;

  const pts = data.map((d, i) => {
    const x = pad.l + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const y = pad.t + innerH - (d.value / max) * innerH;
    return { x, y, ...d };
  });

  const line = smoothPath(pts);
  const area = pts.length
    ? `${line} L${pts[pts.length - 1].x},${baseY} L${pts[0].x},${baseY} Z`
    : "";

  // 4 horizontal gridlines.
  const grids = [0, 0.25, 0.5, 0.75].map((f) => pad.t + innerH * f);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-48 w-full"
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

      {area && <path className="animate-fade-up" d={area} fill="url(#areaFill)" />}
      {line && (
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
          {/* Persistent value label — visible on touch/keyboard/everyone (no hover-only). */}
          {p.value > 0 && (
            <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f766e" className="nums">
              {p.value}
            </text>
          )}
          <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="#0d9488" strokeWidth="2" />
          <text x={p.x} y={H - 8} textAnchor="middle" fontSize="11" fill="#64748b">
            {p.label}
          </text>
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
  const W = 560, H = 220;
  const pad = { l: 12, r: 12, t: 20, b: 28 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const max = Math.max(1, ...data.map((d) => d.value));
  const baseY = pad.t + innerH;
  const pts = data.map((d, i) => ({
    x: pad.l + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW),
    y: pad.t + innerH - (d.value / max) * innerH,
    label: d.label, value: d.value, forecast: !!d.forecast,
  }));
  const fi = pts.findIndex((p) => p.forecast);
  const actual = fi === -1 ? pts : pts.slice(0, fi);
  const forecast = fi === -1 ? [] : pts.slice(Math.max(0, fi - 1)); // start at last actual to connect
  const actualLine = smoothPath(actual);
  const actualArea = actual.length
    ? `${actualLine} L${actual[actual.length - 1].x},${baseY} L${actual[0].x},${baseY} Z`
    : "";
  const forecastLine = smoothPath(forecast);
  const grids = [0, 0.25, 0.5, 0.75].map((f) => pad.t + innerH * f);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full" role="img" aria-label="Trend with forecast">
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
      {actualArea && <path className="animate-fade-up" d={actualArea} fill={`url(#${idPrefix}Fill)`} />}
      {actualLine && (
        <path d={actualLine} fill="none" stroke={`url(#${idPrefix}Line)`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {forecastLine && (
        <path d={forecastLine} fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {fi > 0 && (
        <line x1={pts[fi - 1].x} y1={pad.t} x2={pts[fi - 1].x} y2={baseY} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
      )}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill="#fff" stroke={p.forecast ? "#94a3b8" : "#0d9488"} strokeWidth="2" />
          <text x={p.x} y={H - 8} textAnchor="middle" fontSize="11" fill={p.forecast ? "#94a3b8" : "#64748b"}>
            {p.label}
          </text>
        </g>
      ))}
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
};

export function Donut({
  data,
}: {
  data: { label: string; status: string; value: number }[];
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
          <div className="mt-0.5 text-[11px] font-medium text-slate-400">vendors</div>
        </div>
      </div>

      <ul className="w-full space-y-2">
        {data.map((d) => {
          const pct = total ? Math.round((d.value / total) * 100) : 0;
          return (
            <li key={d.status} className="flex items-center gap-2.5 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: STATUS_COLOR[d.status] ?? "#94a3b8" }}
              />
              <span className="text-slate-600">{d.label}</span>
              <span className="nums ml-auto font-semibold text-slate-700">{d.value}</span>
              <span className="nums w-9 text-right text-xs text-slate-400">{pct}%</span>
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
  return (
    <div className="flex h-44 items-end gap-3">
      {data.map((d, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <span className="nums text-[11px] font-semibold text-slate-600">{d.value || ""}</span>
          <div
            className="grow-bar w-full max-w-12 rounded-t-md bg-gradient-to-t from-brand-600 to-brand-300"
            style={{
              height: `${d.value > 0 ? Math.max((d.value / max) * 100, 4) : 0}%`,
              animationDelay: `${i * 60}ms`,
            }}
          />
          <span className="w-full truncate text-center text-[11px] text-slate-400" title={d.label}>{d.label}</span>
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
}: {
  items: { label: string; value: number; max?: number; href?: string }[];
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
              <span className="nums ml-2 font-medium text-slate-700">{item.value}</span>
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
