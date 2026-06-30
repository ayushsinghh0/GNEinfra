"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/components/ui";

type Tone = "success" | "error" | "info";
type ToastItem = { id: number; message: string; tone: Tone };

// Module-level store so `toast()` can be called from any client component; the
// single <Toaster/> (mounted in the (erp) layout, which persists across page
// navigations) subscribes and renders — so toasts survive a post-action redirect.
let items: ToastItem[] = [];
const listeners = new Set<() => void>();
let nextId = 1;

function emit() {
  for (const l of listeners) l();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function toast(message: string, tone: Tone = "success") {
  const id = nextId++;
  items = [...items, { id, message, tone }];
  emit();
  setTimeout(() => dismiss(id), 3500);
}

const EMPTY: ToastItem[] = [];
const noopSubscribe = () => () => {};

export function Toaster() {
  const list = useSyncExternalStore(
    subscribe,
    () => items,
    () => EMPTY
  );
  // Client-only render (server + first hydration pass → false, then true) so the
  // portal is never produced during SSR — no hydration mismatch, no setState-in-effect.
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!isClient) return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
    >
      {list.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm shadow-[var(--shadow-pop)] motion-safe:animate-fade-up",
            t.tone === "error"
              ? "border-rose-200 text-rose-800"
              : t.tone === "info"
                ? "border-slate-200 text-slate-800"
                : "border-emerald-200 text-emerald-800"
          )}
        >
          {t.tone === "error" ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          )}
          <span>{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="ml-1 text-slate-400 hover:text-slate-600"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}
