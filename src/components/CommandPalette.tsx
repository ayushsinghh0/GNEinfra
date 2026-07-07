"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, User, Laptop, FolderKanban, UserPlus, CornerDownLeft } from "lucide-react";
import { cn } from "@/components/ui";

/**
 * Global Cmd/Ctrl-K command palette — searches HR entities via the
 * Task-9 `/api/hr/search` route and offers role-gated "verb" quick actions.
 * Mounted ONCE in `src/app/(erp)/layout.tsx` (a client sibling of
 * `<Toaster/>`), so it persists across client-side navigations.
 *
 * Role scoping: `rbac.ts` is server-only, so the server layout computes
 * `canSearch`/`canWrite` from HR_VIEW/HR_WRITE and passes them down as plain
 * booleans (never import rbac.ts here). `!canSearch` → render null AND skip
 * the keydown listener entirely, so non-HR roles (BD/SCM/PROJECT/FINANCE) —
 * who can't call /api/hr/search anyway — get no palette, not even Cmd-K
 * capture. `canWrite` (HR_WRITE, i.e. not MANAGER) additionally gates the
 * mutating "verb" actions.
 */

type EmployeeResult = { id: string; empId: string; name: string; designation: string };
type AssetResult = { id: string; employeeId: string; label: string };
type ProjectResult = { id: string; code: string; name: string };
type SearchPayload = { employees: EmployeeResult[]; assets: AssetResult[]; projects: ProjectResult[] };

const EMPTY_RESULTS: SearchPayload = { employees: [], assets: [], projects: [] };

type FlatItem =
  | ({ kind: "employee" } & EmployeeResult)
  | ({ kind: "asset" } & AssetResult)
  | ({ kind: "project" } & ProjectResult)
  | { kind: "action"; id: "new-employee"; label: string; hint: string };

type ActionItem = Extract<FlatItem, { kind: "action" }>;

const noopSubscribe = () => () => {};

function hrefFor(item: FlatItem): string {
  switch (item.kind) {
    case "employee":
      return `/hr/employees/${item.id}`;
    case "asset":
      return `/hr/employees/${item.employeeId}/assets`;
    case "project":
      return `/hr/projects/${item.id}`;
    case "action":
      return "/hr/employees/new";
  }
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 first:pt-1.5">
      {label}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-500">
      {children}
    </kbd>
  );
}

function Row({
  id,
  active,
  icon,
  title,
  subtitle,
  onSelect,
  onHover,
}: {
  id: string;
  active: boolean;
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onClick={onSelect}
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
        active ? "bg-brand-50 text-brand-900" : "text-slate-700 hover:bg-slate-50"
      )}
    >
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
          active ? "bg-white text-brand-600" : "bg-slate-100 text-slate-400"
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        {subtitle && <span className="block truncate text-xs text-slate-400">{subtitle}</span>}
      </span>
    </div>
  );
}

export default function CommandPalette({
  canSearch,
  canWrite,
}: {
  canSearch: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  // Client-only render (SSR + first hydration pass → false) so the portal is
  // never produced during SSR — mirrors Toast.tsx's isClient guard.
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchPayload>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const actions = useMemo<ActionItem[]>(
    () =>
      canWrite
        ? [{ kind: "action" as const, id: "new-employee" as const, label: "New employee", hint: "Create an employee record" }]
        : [],
    [canWrite]
  );

  const flatList = useMemo<FlatItem[]>(
    () => [
      ...results.employees.map((e) => ({ kind: "employee" as const, ...e })),
      ...results.assets.map((a) => ({ kind: "asset" as const, ...a })),
      ...results.projects.map((p) => ({ kind: "project" as const, ...p })),
      ...actions,
    ],
    [results, actions]
  );

  const employeeOffset = 0;
  const assetOffset = results.employees.length;
  const projectOffset = assetOffset + results.assets.length;
  const actionOffset = projectOffset + results.projects.length;

  // Highlights `idx` — called from mouse (onHover) and mirrored inline in the
  // keyboard handler's Arrow branches.
  function focusRow(idx: number) {
    setActiveIndex(idx);
  }

  // Closes AND resets — the single exit path used by Escape, backdrop click,
  // Cmd/Ctrl-K-while-open, and (after selectItem's router.push) picking a
  // result, so the next open always starts from a clean slate. Deliberately
  // a plain callback (not a useEffect reacting to `open`): react-hooks'
  // set-state-in-effect rule flags synchronous setState in an effect body
  // that doesn't itself register a subscription — this is the "adjust state
  // in the event handler that caused the change" alternative it recommends.
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults(EMPTY_RESULTS);
    setLoading(false);
    setActiveIndex(0);
  }, []);

  const selectItem = useCallback(
    (item: FlatItem) => {
      router.push(hrefFor(item));
      close();
    },
    [router, close]
  );

  // Visible-affordance hook: the sidebar's "Search ⌘K/Ctrl K" button (role-
  // gated the same way, see Sidebar.tsx) dispatches this custom DOM event
  // instead of importing/calling into this component directly — keeps the
  // two files decoupled (a plain global event, no shared client state/
  // context needed for a once-per-app trigger).
  useEffect(() => {
    if (!canSearch) return;
    function onOpenEvent() { setOpen(true); }
    window.addEventListener("open-command-palette", onOpenEvent);
    return () => window.removeEventListener("open-command-palette", onOpenEvent);
  }, [canSearch]);

  // Single global shortcut listener — registered ONLY when canSearch (HR_VIEW).
  // Non-HR roles get no listener at all, so Cmd/Ctrl-K is a silent no-op for
  // them everywhere in the app (they can't call /api/hr/search anyway).
  useEffect(() => {
    if (!canSearch) return;
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (open) close();
        else setOpen(true);
        return;
      }
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (flatList.length === 0) return;
        const next = (activeIndex + 1) % flatList.length;
        setActiveIndex(next);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (flatList.length === 0) return;
        const next = (activeIndex - 1 + flatList.length) % flatList.length;
        setActiveIndex(next);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = flatList[activeIndex];
        if (item) selectItem(item);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canSearch, open, flatList, activeIndex, close, selectItem]);

  // Focus + body-scroll lock while open, mirroring SlideOver.tsx. The
  // cleanup (fires on close or unmount) restores the pre-open scroll state
  // and returns focus to whatever had it before the palette opened. (This
  // effect only touches the DOM/refs, never React state, so it's exempt
  // from the set-state-in-effect concern above.)
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Debounced (~200ms), cancellable search. Only fires once open. Everything
  // — including the "query too short" reset — is deferred into the
  // setTimeout callback so the effect body itself only ever sets up a timer
  // + AbortController and returns a cleanup; no synchronous setState in the
  // effect body (see close(), above, for why that matters here). The
  // AbortController cancels the in-flight request on every keystroke so a
  // slow early response can't clobber a later one.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (q.length < 2) {
        setResults(EMPTY_RESULTS);
        setLoading(false);
        setActiveIndex(0);
        return;
      }
      setLoading(true);
      fetch(`/api/hr/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((res) => (res.ok ? (res.json() as Promise<SearchPayload>) : Promise.reject(new Error("search failed"))))
        .then((data) => {
          const next: SearchPayload = {
            employees: data.employees ?? [],
            assets: data.assets ?? [],
            projects: data.projects ?? [],
          };
          setResults(next);
          setActiveIndex(0);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setResults(EMPTY_RESULTS);
          setActiveIndex(0);
        })
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  if (!canSearch || !isClient || !open) return null;

  const hasQuery = query.trim().length >= 2;
  const entityCount = results.employees.length + results.assets.length + results.projects.length;
  const noResults = hasQuery && !loading && entityCount === 0;
  const activeId = flatList[activeIndex] ? `cmdk-item-${activeIndex}` : undefined;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm motion-safe:animate-overlay-in"
        onClick={close}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        tabIndex={-1}
        className="fixed left-1/2 top-[10vh] z-[101] flex max-h-[70vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-xl bg-white shadow-[var(--shadow-pop)] outline-none motion-safe:animate-modal-in"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search employees, assets, projects…"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-listbox"
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            className="h-14 w-full border-0 bg-transparent p-0 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0 sm:text-base"
          />
        </div>

        <div id="cmdk-listbox" role="listbox" aria-label="Search results and quick actions" className="flex-1 overflow-y-auto p-2">
          <div aria-live="polite" className="sr-only">
            {loading ? "Searching…" : noResults ? `No results for ${query.trim()}` : ""}
          </div>

          {!hasQuery && entityCount === 0 && (
            <p className="px-2.5 py-6 text-center text-sm text-slate-400">
              Type at least 2 characters to search employees, assets or projects.
            </p>
          )}

          {noResults && (
            <p className="px-2.5 py-6 text-center text-sm text-slate-400">No results for &ldquo;{query.trim()}&rdquo;.</p>
          )}

          {results.employees.length > 0 && (
            <div>
              <SectionHeader label="Employees" />
              {results.employees.map((e, i) => (
                <Row
                  key={e.id}
                  id={`cmdk-item-${employeeOffset + i}`}
                  active={activeIndex === employeeOffset + i}
                  icon={<User className="h-4 w-4" />}
                  title={e.name}
                  subtitle={
                    <>
                      <span className="nums font-mono">{e.empId}</span>
                      {e.designation ? ` · ${e.designation}` : ""}
                    </>
                  }
                  onHover={() => focusRow(employeeOffset + i)}
                  onSelect={() => selectItem({ kind: "employee", ...e })}
                />
              ))}
            </div>
          )}

          {results.assets.length > 0 && (
            <div>
              <SectionHeader label="Assets" />
              {results.assets.map((a, i) => (
                <Row
                  key={a.id}
                  id={`cmdk-item-${assetOffset + i}`}
                  active={activeIndex === assetOffset + i}
                  icon={<Laptop className="h-4 w-4" />}
                  title={a.label || "Asset"}
                  onHover={() => focusRow(assetOffset + i)}
                  onSelect={() => selectItem({ kind: "asset", ...a })}
                />
              ))}
            </div>
          )}

          {results.projects.length > 0 && (
            <div>
              <SectionHeader label="Projects" />
              {results.projects.map((p, i) => (
                <Row
                  key={p.id}
                  id={`cmdk-item-${projectOffset + i}`}
                  active={activeIndex === projectOffset + i}
                  icon={<FolderKanban className="h-4 w-4" />}
                  title={p.name}
                  subtitle={<span className="nums font-mono">{p.code}</span>}
                  onHover={() => focusRow(projectOffset + i)}
                  onSelect={() => selectItem({ kind: "project", ...p })}
                />
              ))}
            </div>
          )}

          {actions.length > 0 && (
            <div className={cn(entityCount > 0 && "mt-1 border-t border-slate-100 pt-1")}>
              <SectionHeader label="Quick actions" />
              {actions.map((a, i) => (
                <Row
                  key={a.id}
                  id={`cmdk-item-${actionOffset + i}`}
                  active={activeIndex === actionOffset + i}
                  icon={<UserPlus className="h-4 w-4" />}
                  title={a.label}
                  subtitle={a.hint}
                  onHover={() => focusRow(actionOffset + i)}
                  onSelect={() => selectItem(a)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>
                <CornerDownLeft className="h-2.5 w-2.5" />
              </Kbd>{" "}
              select
            </span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>esc</Kbd> close
          </span>
        </div>
      </div>
    </>,
    document.body
  );
}
