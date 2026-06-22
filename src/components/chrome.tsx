import * as React from "react";
import { cn, Eyebrow } from "@/components/ui";

/* ─────────────────────────────────────────────────────────────────────────
   Soft Wave atmosphere primitives. Composable chrome decoration — heroes,
   rails, hero bands, success/empty states ONLY. Never behind form fields or
   data tables (guardrail #1). All presentational (usable in server or client).
   ──────────────────────────────────────────────────────────────────────── */

// Soft solar sun-glow. Size/position via className (e.g. "-top-12 -right-10 h-40 w-40").
export function SunGlow({
  className,
  animate,
}: {
  className?: string;
  animate?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute rounded-full", animate && "anim-sun", className)}
      style={{
        background:
          "radial-gradient(circle, rgba(253,224,71,0.85), rgba(245,158,11,0.22) 55%, transparent 72%)",
        filter: "blur(2px)",
      }}
    />
  );
}

// Concentric ray arcs (thin rings). Position/size via className.
export function RayArcs({
  className,
  stroke = "rgba(255,255,255,0.22)",
}: {
  className?: string;
  stroke?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      fill="none"
      className={cn("pointer-events-none absolute", className)}
    >
      <circle cx="50" cy="50" r="48" stroke={stroke} />
      <circle cx="50" cy="50" r="34" stroke={stroke} />
      <circle cx="50" cy="50" r="20" stroke={stroke} />
    </svg>
  );
}

// Blurred brand blob. Color + size/position via props/className.
export function Blob({
  className,
  color = "rgba(20,184,166,0.35)",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute rounded-full blur-3xl", className)}
      style={{ background: color }}
    />
  );
}

// Organic SVG wave divider. Place absolutely at a hero's bottom edge.
export function Wave({
  className,
  fill = "#ffffff",
  height = 36,
}: {
  className?: string;
  fill?: string;
  height?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 280 34"
      preserveAspectRatio="none"
      height={height}
      className={cn("block w-full", className)}
    >
      <path d="M0,18 C46,36 92,2 140,15 C190,30 236,4 280,16 L280,34 L0,34 Z" fill={fill} />
    </svg>
  );
}

// Dot-grid + grain overlay for a hero surface (chrome only).
export function Atmosphere({
  dots = true,
  grain = true,
  className,
}: {
  dots?: boolean;
  grain?: boolean;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {dots && <div className="gne-dots absolute inset-0" />}
      {grain && <div className="gne-grain absolute inset-0" />}
    </div>
  );
}

/* ── BrandHero — the reusable sunrise band ───────────────────────────────── */
type HeroSize = "lg" | "md" | "sm";
const HERO_TITLE: Record<HeroSize, string> = {
  lg: "text-3xl sm:text-4xl lg:text-5xl",
  md: "text-2xl sm:text-3xl",
  sm: "text-xl sm:text-2xl",
};

export function BrandHero({
  variant = "teal",
  size = "md",
  eyebrow,
  title,
  subtitle,
  wave = true,
  atmosphere = true,
  sun = true,
  className,
  children,
}: {
  variant?: "teal" | "mint";
  size?: HeroSize;
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  wave?: boolean;
  atmosphere?: boolean;
  sun?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const teal = variant === "teal";
  return (
    <div
      className={cn(
        "relative overflow-hidden",
        teal
          ? "bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 text-white"
          : "bg-gradient-to-br from-brand-100 via-brand-100 to-brand-200 text-slate-900",
        className
      )}
    >
      {sun && <SunGlow className="-top-14 -right-10 h-40 w-40" />}
      {atmosphere && <Atmosphere dots grain={teal} />}
      <div className="relative z-10">
        {eyebrow && (
          <Eyebrow className={teal ? "text-white" : "text-brand-800"}>{eyebrow}</Eyebrow>
        )}
        {title && (
          <h1
            className={cn(
              "font-display font-extrabold tracking-[-0.02em]",
              HERO_TITLE[size],
              eyebrow ? "mt-2" : ""
            )}
          >
            {title}
          </h1>
        )}
        {subtitle && (
          <p className={cn("mt-2 text-sm leading-relaxed", teal ? "text-white/90" : "text-slate-600")}>
            {subtitle}
          </p>
        )}
        {children}
      </div>
      {wave && <Wave className="absolute inset-x-0 bottom-[-1px]" />}
    </div>
  );
}

/* ── SuccessCheck — self-drawing ring + tick (the "earned" moment) ───────── */
export function SuccessCheck({
  className,
  confetti = false,
}: {
  className?: string;
  confetti?: boolean;
}) {
  // Stable, deterministic confetti specks (no Math.random — SSR-safe).
  const specks = [
    { x: "26%", y: "30%", c: "#fbbf24", r: false },
    { x: "70%", y: "26%", c: "#14b8a6", r: false },
    { x: "80%", y: "44%", c: "#5eead4", r: true },
    { x: "16%", y: "46%", c: "#0d9488", r: true },
    { x: "50%", y: "16%", c: "#f59e0b", r: true },
  ];
  return (
    <div className={cn("relative inline-grid place-items-center", className)}>
      {confetti &&
        specks.map((s, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="animate-fade-up absolute h-1.5 w-1.5"
            style={{ left: s.x, top: s.y, background: s.c, borderRadius: s.r ? "999px" : "2px", animationDelay: "0.9s" }}
          />
        ))}
      <svg viewBox="0 0 100 100" className="h-24 w-24" aria-hidden="true">
        <circle className="draw-ring stroke-brand-500" cx="50" cy="50" r="42" fill="none" strokeWidth="5" strokeLinecap="round" />
        <path className="draw-tick stroke-brand-700" d="M34 51 L45 62 L66 40" fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
