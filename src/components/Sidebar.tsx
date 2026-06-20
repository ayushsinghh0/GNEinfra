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
// menu logic is never duplicated. `collapsed` drives the md icon-rail look:
// when true, labels/headings collapse to the lg breakpoint (hidden below lg)
// and rows center their icons; the drawer passes collapsed={false} so labels
// are always visible.
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
        className={`px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${headingCls}`}
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
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${rowJustify} ${
                  active
                    ? "bg-brand/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand" />
                )}
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                    active ? "text-brand-300" : "text-slate-500 group-hover:text-slate-300"
                  }`}
                />
                <span className={labelCls}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div
        className={`px-3 pb-2 pt-7 text-[11px] font-semibold uppercase tracking-wider text-slate-600 ${headingCls}`}
      >
        Coming soon
      </div>
      <ul className="space-y-1">
        {upcoming.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.label}>
              <div
                className={`flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 ${rowJustify}`}
                title={collapsed ? item.label : "Available in a later phase"}
              >
                <Icon className="h-[18px] w-[18px] shrink-0 text-slate-700" />
                <span className={labelCls}>{item.label}</span>
                <span
                  className={`ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 ${labelCls}`}
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
    <div className="border-t border-white/5 p-3">
      <button
        onClick={onLogout}
        title={collapsed ? "Log out" : undefined}
        className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white ${rowJustify}`}
      >
        <LogOut className="h-[18px] w-[18px] shrink-0 text-slate-500 transition-colors group-hover:text-slate-300" />
        <span className={labelCls}>Log out</span>
      </button>
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

  // Close the drawer when the route changes. Guard with a ref so this only
  // reacts to an actual pathname change, not the initial mount.
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
      <aside className="hidden md:flex md:w-16 lg:w-64 shrink-0 flex-col bg-slate-900 text-slate-300 sticky top-0 h-dvh self-start">
        {/* Logo block: mark only at md, mark + text at lg */}
        <div className="flex h-16 items-center gap-3 border-b border-white/5 px-5 md:justify-center lg:justify-start">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-white text-sm font-bold tracking-tight shadow-sm shadow-brand/30">
            GNE
          </div>
          <div className="hidden leading-tight lg:block">
            <div className="text-sm font-semibold tracking-tight text-white">GNE ERP</div>
            <div className="text-[11px] text-slate-500">Vendor Portal</div>
          </div>
        </div>

        <NavItems collapsed pathname={pathname} onNavigate={() => setOpen(false)} />
        <LogoutButton collapsed onLogout={logout} />
      </aside>

      {/* ── Mobile: fixed top bar (under md) ────────────────────────────── */}
      <header className="md:hidden fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-white/5 bg-slate-900 px-4 text-white">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-sidebar"
          className="grid h-9 w-9 place-items-center rounded-lg text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white text-[11px] font-bold tracking-tight shadow-sm shadow-brand/30">
          GNE
        </div>
        <span className="text-sm font-semibold tracking-tight">GNE ERP</span>
      </header>

      {/* ── Mobile: dimmed backdrop ─────────────────────────────────────── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
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
        className={`md:hidden fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 text-slate-300 transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/5 px-5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-white text-sm font-bold tracking-tight shadow-sm shadow-brand/30">
            GNE
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-white">GNE ERP</div>
            <div className="text-[11px] text-slate-500">Vendor Portal</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
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
