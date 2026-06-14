import * as React from "react";

// Tiny class combiner (no dependency needed).
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ── Buttons ─────────────────────────────────────────────────────────────
   Use <Button> in client components, or btn() to style a <Link> in server
   components:  <Link className={btn("primary","sm")}>…</Link>
   ──────────────────────────────────────────────────────────────────────── */
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-brand-600 to-brand-700 text-white shadow-sm hover:from-brand-500 hover:to-brand-600 focus-visible:ring-brand/30 active:translate-y-px",
  secondary:
    "bg-white text-slate-700 border border-slate-200 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-slate-300",
  ghost: "text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-300",
  danger:
    "bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus-visible:ring-rose-400 active:translate-y-px",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
};

export function btn(variant: Variant = "primary", size: Size = "md") {
  return cn(
    "inline-flex items-center justify-center font-medium transition-all outline-none focus-visible:ring-2 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap select-none",
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

/* ── Cards ──────────────────────────────────────────────────────────────── */
export const cardCls =
  "bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.03)]";

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
      <div>
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
export const inputCls =
  "w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:bg-slate-50";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      {...props}
      className={cn(inputCls, "h-auto py-2 leading-relaxed", props.className)}
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
  htmlFor,
  className,
  children,
}: {
  label: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
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
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
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
        "inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ── Stat card (dashboard) ──────────────────────────────────────────────── */
const STAT_TONES: Record<string, string> = {
  brand: "bg-brand-50 text-brand-700",
  amber: "bg-amber-50 text-amber-600",
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  slate: "bg-slate-100 text-slate-600",
};

export function StatCard({
  label,
  value,
  icon,
  tone = "brand",
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "brand" | "amber" | "blue" | "emerald" | "slate";
  className?: string;
}) {
  return (
    <div
      className={cn(
        cardCls,
        "p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(16,24,40,0.08)]",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-slate-500">{label}</span>
        {icon && (
          <span className={cn("grid h-9 w-9 place-items-center rounded-xl", STAT_TONES[tone])}>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums">
        {value}
      </div>
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
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-slate-200/60">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {description && <p className="mt-1 text-sm text-slate-500 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ── Page header bar ────────────────────────────────────────────────────── */
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
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/80 px-8 backdrop-blur-md">
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
    brand: "bg-brand",
    amber: "bg-amber-500",
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
  };
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-slate-100", className)}>
      <div className={cn("h-2 rounded-full transition-all", tones[tone])} style={{ width: `${v}%` }} />
    </div>
  );
}

/* ── Table helpers ──────────────────────────────────────────────────────── */
export function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full text-sm">{children}</table>;
}

export const thCls =
  "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400";
export const tdCls = "px-4 py-3.5 text-sm text-slate-700 align-middle";
export const theadRowCls = "border-b border-slate-200/80";
export const trCls =
  "border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors";
