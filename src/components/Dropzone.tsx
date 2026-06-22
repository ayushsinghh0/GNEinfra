"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { UploadCloud, FileText, X, Check } from "lucide-react";
import { cn } from "@/components/ui";

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const keyOf = (f: File) => `${f.name}:${f.size}`;

/**
 * Premium drag-drop uploader with thumbnails + per-file remove.
 * Keeps a real (visually-hidden) <input> in sync via DataTransfer so the
 * surrounding <form>'s FormData + image compression keep working unchanged.
 * Honors prefers-reduced-motion (CSS) and keeps the native picker for mobile/a11y.
 */
export default function Dropzone({
  name,
  label,
  hint,
  multiple = false,
  accept = ".pdf,image/*",
  error,
  onFiles,
  className,
}: {
  name?: string;
  label: string;
  hint?: string;
  multiple?: boolean;
  accept?: string;
  error?: string;
  onFiles?: (files: File[]) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const reactId = useId();
  const errId = `${name ?? reactId}-error`;

  // Derive image object-URLs from the current files; revoke on change / unmount.
  // Kept in state (not a ref) so render reads state, never a ref.
  useEffect(() => {
    const next: Record<string, string> = {};
    files.forEach((f) => {
      if (f.type.startsWith("image/")) next[keyOf(f)] = URL.createObjectURL(f);
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derive object-URLs from files
    setUrls(next);
    return () => {
      Object.values(next).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [files]);

  const syncInput = useCallback((list: File[]) => {
    const el = inputRef.current;
    if (!el || typeof DataTransfer === "undefined") return;
    const dt = new DataTransfer();
    list.forEach((f) => dt.items.add(f));
    el.files = dt.files;
  }, []);

  // Pure updates: compute `next` from the current `files`, commit it, THEN run
  // side-effects (DOM input sync + parent callback). Never mutate the DOM or call
  // a parent setter inside a setState updater — under React 19 StrictMode /
  // concurrent render that can fire twice or against discarded state, which would
  // desync inputRef.files (read by FormData) from committed state and silently
  // drop/duplicate a KYC document.
  const apply = useCallback(
    (incoming: File[]) => {
      if (!incoming.length) return;
      let next: File[];
      if (multiple) {
        const seen = new Set(files.map(keyOf));
        next = [...files, ...incoming.filter((f) => !seen.has(keyOf(f)))];
      } else {
        next = incoming.slice(-1);
      }
      setFiles(next);
      syncInput(next);
      onFiles?.(next);
    },
    [files, multiple, onFiles, syncInput]
  );

  const removeAt = useCallback(
    (i: number) => {
      const next = files.filter((_, idx) => idx !== i);
      setFiles(next);
      syncInput(next);
      onFiles?.(next);
    },
    [files, onFiles, syncInput]
  );

  return (
    <div className={className}>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          apply(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "group flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed px-4 py-6 text-center transition-colors",
          error
            ? "border-rose-300 bg-rose-50/40"
            : drag
              ? "border-brand bg-brand-50/70 ring-2 ring-brand/30"
              : "border-slate-300 bg-slate-50/50 hover:border-brand hover:bg-brand-50/40"
        )}
      >
        <span
          className={cn(
            "grid h-10 w-10 place-items-center rounded-xl transition-colors",
            drag ? "bg-brand text-white" : "bg-white text-brand-600 ring-1 ring-slate-200 group-hover:text-brand-700"
          )}
        >
          <UploadCloud className="h-5 w-5" />
        </span>
        <span className="text-sm font-semibold text-slate-700">
          {label}
          {hint && <span className="ml-1 font-normal text-slate-500">— {hint}</span>}
        </span>
        <span className="text-xs text-slate-500">
          Drag &amp; drop, or <span className="font-medium text-brand-700">browse</span> · PDF or image, max 10&nbsp;MB
        </span>
        <input
          ref={inputRef}
          name={name}
          type="file"
          multiple={multiple}
          accept={accept}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          onChange={(e) => apply(Array.from(e.target.files ?? []))}
          className="sr-only"
        />
      </label>

      {files.length > 0 && (
        <ul className="mt-2.5 space-y-2">
          {files.map((f, i) => {
            const url = urls[keyOf(f)];
            return (
              <li
                key={keyOf(f) + i}
                className="animate-fade-up flex items-center gap-3 rounded-xl bg-white px-3 py-2 shadow-[var(--shadow-card)]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100 text-slate-400">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-700">{f.name}</span>
                  <span className="nums block text-xs text-slate-500">{fmtBytes(f.size)}</span>
                </span>
                {!error && (
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500 text-white" aria-label="Attached">
                    <Check className="h-3 w-3" />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label={`Remove ${f.name}`}
                  className="press grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <span id={errId} aria-live="polite" className="animate-fade-up mt-2 block text-xs font-medium text-rose-600">
          {error}
        </span>
      )}
    </div>
  );
}
