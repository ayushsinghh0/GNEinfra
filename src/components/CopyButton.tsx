"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "@/components/Toast";

/**
 * Copy-to-clipboard affordance for code-like `KeyValue` fields (EMP ID, PAN,
 * IFSC, …). `KeyValue`/`ui.tsx` render server-side, so this tiny client
 * island exists purely to host the `navigator.clipboard` interaction.
 *
 * Visual footprint stays small (16px icon, doesn't inflate the KeyValue
 * row's height) while an absolutely-positioned `::before` pseudo-element
 * expands the actual tap/click target to ~44px per the 44px guardrail —
 * pseudo-elements participate in their host's hit-testing, so this doesn't
 * require any layout-affecting padding/margin.
 */
export default function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast("Copied", "success");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast("Couldn't copy — clipboard blocked", "error");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy"
      className={
        "press relative inline-flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 outline-none transition-colors hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-1 before:absolute before:-inset-[14px] before:content-['']" +
        (className ? ` ${className}` : "")
      }
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
