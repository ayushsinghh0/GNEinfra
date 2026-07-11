"use client";

import * as React from "react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/components/ui";

/**
 * Accessible right-anchored slide-over panel. Mirrors the mobile-sidebar
 * pattern (translate-x transition + blurred backdrop + Escape to close), so it
 * stays consistent with the rest of the chrome and respects reduced-motion.
 *
 * Rendered into document.body via a portal (same as ConfirmDialog): triggers
 * often live inside the sticky `.glass` PageHeader, whose backdrop-filter
 * makes it the containing block for `fixed` descendants — without the portal
 * the backdrop and panel get trapped inside the header band.
 */
const noopSubscribe = () => () => {};

export default function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  icon,
  footer,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLElement>(null);
  // Client-only render (SSR + first hydration pass → false) so the portal is
  // never produced during SSR — mirrors Toast.tsx's isClient guard.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : "Details"}
        tabIndex={-1}
        inert={!open || undefined}
        className={cn(
          // opacity rides along with the slide so the panel's big tinted shadow
          // fades out too — a closed (off-screen) panel otherwise leaks a green
          // shadow band back into the viewport's right edge.
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-[var(--shadow-pop)] outline-none transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none",
          open ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
          className
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-semibold tracking-tight text-slate-900">{title}</h2>
              {subtitle && <p className="truncate text-sm text-slate-500">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="press grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">{footer}</div>}
      </aside>
    </>,
    document.body
  );
}
