"use client";

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
  ClipboardList,
  Wallet,
  UserRound,
  LogOut,
  type LucideIcon,
} from "lucide-react";

const nav: { href: string; label: string; icon: LucideIcon; exact: boolean }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/vendors", label: "Vendors", icon: Building2, exact: false },
  { href: "/admin/invites", label: "Invitations", icon: Mail, exact: false },
  { href: "/admin/settings", label: "Settings", icon: Settings, exact: false },
];

// Future ERP modules (Phase 2+). Shown disabled so the structure is visible.
const upcoming: { label: string; icon: LucideIcon }[] = [
  { label: "Procurement", icon: Pickaxe },
  { label: "Inventory", icon: Boxes },
  { label: "Project", icon: ClipboardList },
  { label: "Finance", icon: Wallet },
  { label: "HR", icon: UserRound },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.refresh();
  }

  return (
    <aside className="w-64 shrink-0 bg-slate-900 text-slate-300 flex flex-col min-h-screen sticky top-0">
      {/* Logo block */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white text-sm font-bold tracking-tight shadow-sm shadow-brand/30">
          GNE
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight text-white">GNE ERP</div>
          <div className="text-[11px] text-slate-500">Vendor Portal</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Menu
        </div>
        <ul className="space-y-1">
          {nav.map((item) => {
            const active = isActive(item.href, item.exact);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="px-3 pb-2 pt-7 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
          Coming soon
        </div>
        <ul className="space-y-1">
          {upcoming.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label}>
                <div
                  className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600"
                  title="Available in a later phase"
                >
                  <Icon className="h-[18px] w-[18px] shrink-0 text-slate-700" />
                  {item.label}
                  <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Soon
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/5 p-3">
        <button
          onClick={logout}
          className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0 text-slate-500 transition-colors group-hover:text-slate-300" />
          Log out
        </button>
      </div>
    </aside>
  );
}
