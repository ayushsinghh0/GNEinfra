import type { Role } from "@prisma/client";
import {
  LayoutDashboard, Building2, Mail, Settings, Users, Boxes, Wallet, UserRound,
  Briefcase, ClipboardList, FileText, ReceiptText, Truck, PackageCheck,
  CalendarClock, HardHat, BadgeIndianRupee, type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href?: string; icon: LucideIcon; soon?: boolean };
export type NavSection = { heading: string; items: NavItem[] };

const BD: NavSection = {
  heading: "Business Development",
  items: [
    { label: "Dashboard", href: "/bd", icon: LayoutDashboard },
    { label: "Lead", icon: Briefcase, soon: true },
    { label: "Quotation", icon: FileText, soon: true },
    { label: "Purchase Order", icon: ReceiptText, soon: true },
    { label: "Order Confirmation", icon: PackageCheck, soon: true },
  ],
};

const SCM: NavSection = {
  heading: "Supply Chain",
  items: [
    { label: "Dashboard", href: "/scm", icon: LayoutDashboard },
    { label: "Vendors", href: "/scm/vendors", icon: Building2 },
    { label: "Invitations", href: "/scm/invites", icon: Mail },
    { label: "Purchase Requisition", icon: ClipboardList, soon: true },
    { label: "RFQ", icon: FileText, soon: true },
    { label: "Purchase Order", icon: ReceiptText, soon: true },
    { label: "GRN", icon: Truck, soon: true },
    { label: "Inventory", icon: Boxes, soon: true },
  ],
};

const PROJECT: NavSection = {
  heading: "Project",
  items: [
    { label: "Dashboard", href: "/project", icon: LayoutDashboard },
    { label: "BOM", icon: ClipboardList, soon: true },
    { label: "Schedule Planning", icon: CalendarClock, soon: true },
    { label: "Deployment", icon: HardHat, soon: true },
    { label: "Execution", icon: HardHat, soon: true },
    { label: "DPR", icon: FileText, soon: true },
    { label: "Approval", icon: PackageCheck, soon: true },
    { label: "MRC", icon: ClipboardList, soon: true },
    { label: "Billing", icon: ReceiptText, soon: true },
  ],
};

const FINANCE: NavSection = {
  heading: "Finance",
  items: [
    { label: "Dashboard", href: "/finance", icon: LayoutDashboard },
    { label: "Invoice Raise", icon: ReceiptText, soon: true },
    { label: "Invoice Approval", icon: PackageCheck, soon: true },
    { label: "Payment", icon: BadgeIndianRupee, soon: true },
    { label: "Reconciliation", icon: Wallet, soon: true },
  ],
};

const HR: NavSection = {
  heading: "Human Resources",
  items: [
    { label: "Dashboard", href: "/hr", icon: LayoutDashboard },
    { label: "Manpower Planning", icon: Users, soon: true },
    { label: "Recruitment", icon: UserRound, soon: true },
    { label: "Attendance", icon: CalendarClock, soon: true },
    { label: "Payroll", icon: BadgeIndianRupee, soon: true },
  ],
};

const DEPT: Record<"BD" | "SCM" | "PROJECT" | "FINANCE" | "HR", NavSection> = {
  BD, SCM, PROJECT, FINANCE, HR,
};

const OVERVIEW: NavSection = {
  heading: "Overview",
  items: [{ label: "All departments", href: "/overview", icon: LayoutDashboard }],
};

export function deptLabel(role: Role): string {
  switch (role) {
    case "BD": return "Business Development";
    case "SCM": return "Supply Chain";
    case "PROJECT": return "Project";
    case "FINANCE": return "Finance";
    case "HR": return "Human Resources";
    case "MANAGER": return "Manager";
    case "ADMIN": return "Administrator";
    case "SUPERADMIN": return "Super Admin";
    default: return "ERP";
  }
}

export function navForRole(role: Role): NavSection[] {
  if (role === "BD" || role === "SCM" || role === "PROJECT" || role === "FINANCE" || role === "HR") {
    return [DEPT[role]];
  }
  // Oversight: overview + every department + administration.
  const admin: NavSection = {
    heading: "Administration",
    items: [
      { label: "Settings", href: "/admin/settings", icon: Settings },
      ...(role === "SUPERADMIN" ? [{ label: "Users", href: "/admin/users", icon: Users }] : []),
    ],
  };
  return [OVERVIEW, BD, SCM, PROJECT, FINANCE, HR, admin];
}
