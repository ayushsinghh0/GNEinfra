"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { LogOut, Menu, Search, X } from "lucide-react";
import { navForRole, deptLabel, type NavSection } from "@/lib/nav";

type SidebarUser = { name: string; email: string; role: Role };

// Visible discoverability affordance for the Cmd/Ctrl-K command palette
// (CommandPalette.tsx — fully built, but previously keyboard-only-secret).
// Dispatches a plain custom DOM event rather than importing the palette
// directly, so the two client components stay decoupled. `canSearch` is
// computed server-side in (erp)/layout.tsx from HR_VIEW (the same guard
// CommandPalette itself uses) and threaded down here — roles that can't
// call /api/hr/search never see the hint.
function openCommandPalette() {
  window.dispatchEvent(new CustomEvent("open-command-palette"));
}

const noopSubscribe = () => () => {};
// Client-only platform sniff (mirrors CommandPalette.tsx's isClient guard) —
// useSyncExternalStore's server snapshot always reads false, so SSR/first
// hydration render "Ctrl K" and the mac label only appears once hydrated,
// avoiding a setState-in-effect render cascade for a one-time value.
function useKbdHint() {
  const mac = useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? ""),
    () => false
  );
  return mac ? "⌘K" : "Ctrl K";
}

function SearchHintButton() {
  const hint = useKbdHint();
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className="press flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 ring-1 ring-inset ring-slate-200 transition-colors hover:bg-slate-50 hover:text-slate-600"
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left">Search…</span>
      <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-400">
        {hint}
      </kbd>
    </button>
  );
}

function SearchHintIconButton() {
  const hint = useKbdHint();
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-label={`Search (${hint})`}
      title={`Search (${hint})`}
      className="press ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
    >
      <Search className="h-5 w-5" />
    </button>
  );
}

function NavBody({ sections, pathname, onNavigate }: { sections: NavSection[]; pathname: string; onNavigate: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-5">
      {sections.map((section) => (
        <div key={section.heading} className="mb-5 last:mb-0">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section.heading}</div>
          <ul className="space-y-1">
            {section.items.map((item) => {
              const Icon = item.icon;
              if (!item.href || item.soon) {
                return (
                  <li key={item.label}>
                    <div className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-300" title="Available in a later phase">
                      <Icon className="h-[18px] w-[18px] shrink-0 text-slate-300" />
                      <span>{item.label}</span>
                      <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">Soon</span>
                    </div>
                  </li>
                );
              }
              const segs = item.href.split("/").filter(Boolean);
              const isHome = segs.length <= 1; // "/hr","/scm","/overview" are homes → exact match only
              const active = pathname === item.href || (!isHome && pathname.startsWith(item.href + "/"));
              return (
                <li key={item.label}>
                  <Link href={item.href} onClick={onNavigate} className={`press group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}>
                    {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand" />}
                    <Icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${active ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600"}`} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 place-items-center rounded-xl bg-white px-2 ring-1 ring-slate-200">
        <Image src="/brand/gne-infra.png" alt="GNE Infra" width={92} height={26} className="h-6 w-auto" priority />
      </span>
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight text-slate-900">GNE ERP</div>
        <div className="text-[11px] text-slate-400">{subtitle}</div>
      </div>
    </div>
  );
}

export default function Sidebar({ user, canSearch = false }: { user: SidebarUser; canSearch?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const sections = navForRole(user.role);
  const subtitle = deptLabel(user.role);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const LogoutBtn = (
    <div className="border-t border-slate-200 p-3">
      <button onClick={logout} className="press group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600">
        <LogOut className="h-[18px] w-[18px] shrink-0 text-slate-400 transition-colors group-hover:text-rose-500" />
        <span>Log out</span>
      </button>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col self-start border-r border-slate-200 bg-white text-slate-600 md:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-5"><Brand subtitle={subtitle} /></div>
        {canSearch && (
          <div className="px-3 pt-3">
            <SearchHintButton />
          </div>
        )}
        <NavBody sections={sections} pathname={pathname} onNavigate={() => setOpen(false)} />
        {LogoutBtn}
      </aside>

      <header className="glass fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200/70 px-4 md:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="mobile-sidebar" className="press grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
          <Menu className="h-5 w-5" />
        </button>
        <Image src="/brand/gne-infra.png" alt="GNE Infra" width={84} height={24} className="h-6 w-auto" priority />
        {canSearch && <SearchHintIconButton />}
      </header>

      {open && <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside id="mobile-sidebar" role="dialog" aria-modal="true" aria-label="Navigation" inert={!open || undefined} className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white text-slate-600 shadow-xl transition-transform duration-300 ease-out md:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <Brand subtitle={subtitle} />
          <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="press grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <NavBody sections={sections} pathname={pathname} onNavigate={() => setOpen(false)} />
        {LogoutBtn}
      </aside>
    </>
  );
}
