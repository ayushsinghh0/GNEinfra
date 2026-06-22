import * as React from "react";

// Tiny class combiner (no dependency needed).
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ── Buttons ─────────────────────────────────────────────────────────────
   Use <Button> in client components, or btn() to style a <Link> in server
   components:  <Link className={btn("primary","sm")}>…</Link>
   Add `rounded-full` at the call site for pill CTAs (onboarding contexts).
   ──────────────────────────────────────────────────────────────────────── */
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-brand-500 to-brand-700 text-white shadow-[var(--shadow-cta)] hover:brightness-[1.05] focus-visible:ring-brand/40 active:translate-y-px",
  secondary:
    "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 shadow-sm hover:bg-slate-50 hover:ring-slate-300 focus-visible:ring-slate-300/70 active:translate-y-px",
  ghost: "text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-300/70",
  danger:
    "bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_20px_-10px_rgba(244,63,94,0.6)] hover:brightness-[1.05] focus-visible:ring-rose-400/50 active:translate-y-px",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3.5 text-xs gap-1.5 rounded-xl",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-sm gap-2 rounded-2xl",
};

export function btn(variant: Variant = "primary", size: Size = "md") {
  return cn(
    "press touch-manipulation inline-flex items-center justify-center font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap select-none",
    VARIANT[variant],
    SIZE[size]
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return <button className={cn(btn(variant, size), className)} {...props} />;
}

/* ── Eyebrow (small uppercase brand label above headings) ───────────────── */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  // No default color — callers pass the tone (text-brand-700 on white, text-white
  // on heroes) so there's never a class-order ambiguity over the color.
  return (
    <span
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.18em]",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ── Cards ──────────────────────────────────────────────────────────────── */
// Layered, brand-tinted elevation (the depth cue) — the hairline ring IS the
// border, so corners stay clean and surfaces read as lit-from-within.
export const cardCls = "bg-white rounded-2xl shadow-[var(--shadow-card)]";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <section className={cn(cardCls, className)}>{children}</section>;
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-slate-100">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("p-6", className)}>{children}</div>;
}

/* ── Form controls ──────────────────────────────────────────────────────── */
// Recessed "well": faint top gradient + inset shadow define the field edge
// (aids daylight legibility). text-base on mobile (16px) prevents iOS zoom;
// drops to text-sm from sm up for desktop density. Placeholder ≥ slate-500 (AA).
export const inputCls =
  "w-full h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-500 shadow-[var(--field-inset)] outline-none transition focus:border-brand focus:ring-[3px] focus:ring-brand/25 disabled:opacity-60";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      {...props}
      className={cn(inputCls, "h-auto py-2.5 leading-relaxed", props.className)}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputCls, "pr-8", props.className)} />;
}

export function Field({
  label,
  required,
  hint,
  error,
  errorId,
  htmlFor,
  className,
  children,
}: {
  label: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  errorId?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("block", className)}>
      <span className="mb-1.5 flex items-center gap-1 text-[13px] font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-500">*</span>}
        {hint && <span className="font-normal text-slate-400">— {hint}</span>}
      </span>
      {children}
      {error && (
        <span
          id={errorId}
          aria-live="polite"
          className="animate-fade-up mt-1.5 block text-xs font-medium text-rose-600"
        >
          {error}
        </span>
      )}
    </label>
  );
}

/* ── Chip (small count / info pill) ─────────────────────────────────────── */
export function Chip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ── Stat tile (dashboard) ──────────────────────────────────────────────── */
const STAT_TONES: Record<string, { chip: string; spark: string }> = {
  brand: { chip: "bg-brand-50 text-brand-700", spark: "from-brand-500 to-brand-300" },
  amber: { chip: "bg-amber-50 text-amber-600", spark: "from-amber-500 to-amber-300" },
  blue: { chip: "bg-blue-50 text-blue-600", spark: "from-blue-500 to-blue-300" },
  emerald: { chip: "bg-emerald-50 text-emerald-600", spark: "from-emerald-500 to-emerald-300" },
  slate: { chip: "bg-slate-100 text-slate-600", spark: "from-slate-400 to-slate-300" },
};

export function StatCard({
  label,
  value,
  icon,
  tone = "brand",
  spark,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "brand" | "amber" | "blue" | "emerald" | "slate";
  spark?: number; // 0–100 — optional progress whisker
  className?: string;
}) {
  const t = STAT_TONES[tone];
  return (
    <div className={cn(cardCls, "lift p-5", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-slate-500">{label}</span>
        {icon && (
          <span className={cn("grid h-9 w-9 place-items-center rounded-xl", t.chip)}>
            {icon}
          </span>
        )}
      </div>
      <div className="nums mt-3 text-[28px] font-semibold leading-none text-slate-900">
        {value}
      </div>
      {typeof spark === "number" && (
        <div className="mt-3.5 h-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn("h-full rounded-full bg-gradient-to-r", t.spark)}
            style={{ width: `${Math.max(0, Math.min(100, spark))}%` }}
          />
        </div>
      )}
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────────────────────── */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {icon && (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-b from-brand-50 to-white text-brand-600 ring-1 ring-brand-200/60 shadow-sm">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {description && <p className="mt-1 text-sm text-slate-500 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ── Page header bar (frosted, sticky) ──────────────────────────────────── */
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="glass sticky top-14 md:top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200/70 px-6 sm:px-8">
      <div className="flex items-baseline gap-3 min-w-0">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900 truncate">{title}</h1>
        {subtitle && <span className="text-sm text-slate-400 truncate">{subtitle}</span>}
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </header>
  );
}

/* ── Progress bar ───────────────────────────────────────────────────────── */
export function ProgressBar({
  value,
  tone = "brand",
  className,
}: {
  value: number; // 0–100
  tone?: "brand" | "amber" | "emerald" | "blue";
  className?: string;
}) {
  const tones: Record<string, string> = {
    brand: "from-brand-500 to-brand-300",
    amber: "from-amber-500 to-amber-300",
    emerald: "from-emerald-500 to-emerald-300",
    blue: "from-blue-500 to-blue-300",
  };
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-slate-100", className)}>
      <div
        className={cn("h-2 rounded-full bg-gradient-to-r transition-all duration-500", tones[tone])}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

/* ── Skeleton (loading shimmer) ─────────────────────────────────────────── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} aria-hidden="true" />;
}

/* ── Spinner ────────────────────────────────────────────────────────────── */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand",
        className
      )}
    />
  );
}

/* ── Table helpers ──────────────────────────────────────────────────────── */
export function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full text-sm">{children}</table>;
}

export const thCls =
  "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400";
export const tdCls = "px-4 py-3.5 text-sm text-slate-700 align-middle";
export const tdNumCls = "px-4 py-3.5 text-sm text-slate-700 align-middle text-right nums";
export const theadRowCls = "border-b border-slate-200/80";
export const trCls =
  "group relative border-b border-slate-100 last:border-0 transition-colors hover:bg-brand-50/40 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-brand before:opacity-0 before:transition-opacity hover:before:opacity-100";
