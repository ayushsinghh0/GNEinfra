import type { Role } from "@prisma/client";
import {
  LayoutDashboard, Building2, Mail, Settings, Users, Boxes, Wallet,
  Briefcase, ClipboardList, FileText, ReceiptText, Truck, PackageCheck,
  CalendarClock, HardHat, BadgeIndianRupee, FolderKanban, Target, FileDown, type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href?: string; icon: LucideIcon; soon?: boolean };
export type NavSection = { heading: string; items: NavItem[] };

const BD: NavSection = {
  heading: "Business Development",
  items: [
    { label: "Dashboard", href: "/bd", icon: LayoutDashboard },
    { label: "Targets", href: "/bd/targets", icon: Target },
    { label: "Clients", href: "/bd/clients", icon: Building2 },
    { label: "Enquiries & Quotes", href: "/bd/enquiries", icon: FileText },
    { label: "PO Tracker", href: "/bd/pos", icon: ReceiptText },
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
    { label: "Invoice Raise", href: "/finance/invoices", icon: ReceiptText },
    { label: "Invoice Approval", href: "/finance/approvals", icon: PackageCheck },
    { label: "Payment", href: "/finance/payments", icon: BadgeIndianRupee },
    { label: "Reconciliation", href: "/finance/reconciliation", icon: Wallet },
    { label: "Tally Export", href: "/finance/tally", icon: FileDown },
    { label: "Company Details", href: "/finance/company", icon: Building2 },
  ],
};

// Named consts so the grouped HR-role sections in navForRole() can reference the same NavItem
// objects directly instead of doing a stringly-typed label lookup — a future rename/removal here
// becomes a TypeScript error at the const use sites instead of a runtime throw in the Sidebar render.
const HR_DASHBOARD: NavItem = { label: "Dashboard", href: "/hr", icon: LayoutDashboard };
const HR_EMPLOYEES: NavItem = { label: "Employees", href: "/hr/employees", icon: Users };
const HR_ASSETS: NavItem = { label: "Assets", href: "/hr/assets", icon: Boxes };
const HR_ATTENDANCE: NavItem = { label: "Attendance", href: "/hr/attendance", icon: CalendarClock };
const HR_PROJECTS: NavItem = { label: "Projects", href: "/hr/projects", icon: FolderKanban };
const HR_PAYROLL: NavItem = { label: "Payroll", href: "/hr/payroll", icon: Wallet };
const HR_RECRUITMENT: NavItem = { label: "Recruitment", href: "/hr/recruitment", icon: Briefcase };
const HR_POLICIES: NavItem = { label: "Policies", href: "/hr/policies", icon: FileText };

const HR: NavSection = {
  heading: "Human Resources",
  items: [
    HR_DASHBOARD, HR_EMPLOYEES, HR_ATTENDANCE, HR_PAYROLL,
    HR_ASSETS, HR_PROJECTS, HR_RECRUITMENT, HR_POLICIES,
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
  if (role === "HR") {
    // HR-role users get a grouped nav (same items as DEPT.HR, regrouped, via the shared consts
    // above). Oversight roles (ADMIN/MANAGER/SUPERADMIN) keep the flat DEPT.HR section below to
    // avoid a bloated sidebar.
    return [
      { heading: "Overview", items: [HR_DASHBOARD] },
      { heading: "People", items: [HR_EMPLOYEES, HR_ATTENDANCE, HR_PAYROLL] },
      { heading: "Resources", items: [HR_ASSETS, HR_PROJECTS, HR_RECRUITMENT, HR_POLICIES] },
    ];
  }
  if (role === "BD" || role === "SCM" || role === "PROJECT" || role === "FINANCE") {
    return [DEPT[role]];
  }
  // Oversight: overview + every department. Administration only for ADMIN/SUPERADMIN.
  const sections: NavSection[] = [OVERVIEW, BD, SCM, PROJECT, FINANCE, HR];
  if (role === "ADMIN" || role === "SUPERADMIN") {
    sections.push({
      heading: "Administration",
      items: [
        { label: "Settings", href: "/admin/settings", icon: Settings },
        ...(role === "SUPERADMIN" ? [{ label: "Users", href: "/admin/users", icon: Users }] : []),
      ],
    });
  }
  return sections;
}
