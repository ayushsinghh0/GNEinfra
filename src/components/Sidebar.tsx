"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Mail,
  Settings,
  Pickaxe,
  Boxes,
  Wallet,
  UserRound,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

const nav: { href: string; label: string; icon: LucideIcon; exact: boolean }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/vendors", label: "Vendors", icon: Building2, exact: false },
  { href: "/admin/invites", label: "Invitations", icon: Mail, exact: false },
  { href: "/admin/settings", label: "Settings", icon: Settings, exact: false },
];

// Future ERP modules (Phase 3+). Shown disabled so the structure is visible.
const upcoming: { label: string; icon: LucideIcon }[] = [
  { label: "Procurement", icon: Pickaxe },
  { label: "Inventory", icon: Boxes },
  { label: "Finance", icon: Wallet },
  { label: "HR", icon: UserRound },
];

function isActive(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

// Shared nav markup, used by both the in-flow rail and the mobile drawer so the
// menu logic is never duplicated. `collapsed` drives the md icon-rail look.
function NavItems({
  collapsed,
  pathname,
  onNavigate,
}: {
  collapsed: boolean;
  pathname: string;
  onNavigate: () => void;
}) {
  const labelCls = collapsed ? "hidden lg:inline" : "";
  const headingCls = collapsed ? "hidden lg:block" : "";
  const rowJustify = collapsed ? "justify-center lg:justify-start" : "";

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-5">
      <div
        className={`px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 ${headingCls}`}
      >
        Menu
      </div>
      <ul className="space-y-1">
        {nav.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                onClick={onNavigate}
                className={`press group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${rowJustify} ${
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand" />
                )}
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                    active ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600"
                  }`}
                />
                <span className={labelCls}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div
        className={`px-3 pb-2 pt-7 text-[11px] font-semibold uppercase tracking-wider text-slate-300 ${headingCls}`}
      >
        Coming soon
      </div>
      <ul className="space-y-1">
        {upcoming.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.label}>
              <div
                className={`flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 ${rowJustify}`}
                title={collapsed ? item.label : "Available in a later phase"}
              >
                <Icon className="h-[18px] w-[18px] shrink-0 text-slate-300" />
                <span className={labelCls}>{item.label}</span>
                <span
                  className={`ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400 ${labelCls}`}
                >
                  Soon
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function LogoutButton({
  collapsed,
  onLogout,
}: {
  collapsed: boolean;
  onLogout: () => void;
}) {
  const labelCls = collapsed ? "hidden lg:inline" : "";
  const rowJustify = collapsed ? "justify-center lg:justify-start" : "";
  return (
    <div className="border-t border-slate-200 p-3">
      <button
        onClick={onLogout}
        title={collapsed ? "Log out" : undefined}
        className={`press group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 ${rowJustify}`}
      >
        <LogOut className="h-[18px] w-[18px] shrink-0 text-slate-400 transition-colors group-hover:text-rose-500" />
        <span className={labelCls}>Log out</span>
      </button>
    </div>
  );
}

function LogoBlock({ withText }: { withText: boolean }) {
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-brand-500 to-brand-700 text-sm font-extrabold tracking-tight text-white shadow-[var(--shadow-cta)]">
      GNE
      {withText && <span className="sr-only">GNE ERP</span>}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.refresh();
  }

  // Close the drawer when the route changes (only on an actual change).
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  // Close the drawer on Escape while it is open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* ── In-flow rail: collapsed icon-rail at md, full sidebar at lg ──── */}
      <aside className="sticky top-0 hidden h-dvh shrink-0 flex-col self-start border-r border-slate-200 bg-white text-slate-600 md:flex md:w-16 lg:w-64">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5 md:justify-center lg:justify-start">
          <LogoBlock withText />
          <div className="hidden leading-tight lg:block">
            <div className="text-sm font-semibold tracking-tight text-slate-900">GNE ERP</div>
            <div className="text-[11px] text-slate-400">Vendor Portal</div>
          </div>
        </div>

        <NavItems collapsed pathname={pathname} onNavigate={() => setOpen(false)} />
        <LogoutButton collapsed onLogout={logout} />
      </aside>

      {/* ── Mobile: fixed top bar (under md) ────────────────────────────── */}
      <header className="glass fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200/70 px-4 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-sidebar"
          className="press grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <Menu className="h-5 w-5" />
        </button>
        <LogoBlock withText={false} />
        <span className="text-sm font-semibold tracking-tight text-slate-900">GNE ERP</span>
      </header>

      {/* ── Mobile: dimmed backdrop ─────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile: slide-in drawer ─────────────────────────────────────── */}
      <aside
        id="mobile-sidebar"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        inert={!open || undefined}
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white text-slate-600 shadow-xl transition-transform duration-300 ease-out md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <LogoBlock withText={false} />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-slate-900">GNE ERP</div>
            <div className="text-[11px] text-slate-400">Vendor Portal</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="press ml-auto grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <NavItems collapsed={false} pathname={pathname} onNavigate={() => setOpen(false)} />
        <LogoutButton collapsed={false} onLogout={logout} />
      </aside>
    </>
  );
}
