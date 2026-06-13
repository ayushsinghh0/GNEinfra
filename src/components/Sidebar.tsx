"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";

const nav = [
  { href: "/admin", label: "Dashboard", icon: "▦", exact: true },
  { href: "/admin/vendors", label: "Vendors", icon: "▤", exact: false },
  { href: "/admin/invites", label: "Invitations", icon: "✉", exact: false },
  { href: "/admin/settings", label: "Settings", icon: "⚙", exact: false },
];

// Future ERP modules (Phase 2+). Shown disabled so the structure is visible.
const upcoming = [
  { label: "Procurement", icon: "⛏" },
  { label: "Inventory", icon: "▣" },
  { label: "Project", icon: "◷" },
  { label: "Finance", icon: "₹" },
  { label: "HR", icon: "☺" },
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
    <aside className="w-60 shrink-0 bg-slate-900 text-slate-300 flex flex-col min-h-screen sticky top-0">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-slate-800">
        <div className="w-9 h-9 rounded-lg bg-brand text-white grid place-items-center font-bold">
          GNE
        </div>
        <div>
          <div className="text-white font-semibold leading-tight">GNE ERP</div>
          <div className="text-[11px] text-slate-500">Vendor Portal</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
              isActive(item.href, item.exact)
                ? "bg-brand text-white"
                : "hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="w-5 text-center">{item.icon}</span>
            {item.label}
          </Link>
        ))}

        <div className="pt-5 pb-2 px-3 text-[11px] uppercase tracking-wide text-slate-600">
          Coming soon
        </div>
        {upcoming.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 cursor-not-allowed"
            title="Available in a later phase"
          >
            <span className="w-5 text-center">{item.icon}</span>
            {item.label}
          </div>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-slate-800">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-800 hover:text-white transition"
        >
          <span className="w-5 text-center">⏻</span>
          Log out
        </button>
      </div>
    </aside>
  );
}
