import * as React from "react";
import Link from "next/link";
import { requirePageRole, OVERSIGHT } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/format";
import { BrandHero } from "@/components/chrome";
import {
  StatCard,
  Card,
  CardHeader,
  CardBody,
  Chip,
  EntityLink,
  StatusChip,
  EmptyState,
  cardCls,
  cn,
  btn,
} from "@/components/ui";
import {
  Building2,
  Briefcase,
  HardHat,
  Wallet,
  Users,
  Clock,
  CheckCircle2,
  ChevronRight,
  Mail,
  CalendarCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";

type Dept = {
  label: string;
  href: string;
  icon: React.ReactNode;
  desc: string;
  live: boolean;
  stats?: string[];
};

function DepartmentCard({ d }: { d: Dept }) {
  return (
    <Link
      href={d.href}
      className={cn(
        cardCls,
        "lift group block p-5 outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
            d.live ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-400"
          )}
        >
          {d.icon}
        </span>
        {d.live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            Live
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Soon
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-slate-900 transition-colors group-hover:text-brand-700">
          {d.label}
        </h3>
        <ChevronRight className="h-4 w-4 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand-500" />
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{d.desc}</p>
      {d.stats && d.stats.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {d.stats.map((s) => (
            <Chip key={s} className="nums bg-slate-50 ring-1 ring-inset ring-slate-200">
              {s}
            </Chip>
          ))}
        </div>
      )}
    </Link>
  );
}

export default async function OverviewPage() {
  await requirePageRole(OVERSIGHT);

  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const [vendors, awaiting, pendingInvites, activeEmployees, presentToday, activeProjects, reviewQueue] =
    await Promise.all([
      prisma.vendor.count(),
      prisma.vendor.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
      prisma.vendorInvite.count({
        where: { status: "PENDING", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      }),
      prisma.employee.count({ where: { status: "ACTIVE" } }),
      prisma.attendanceRecord.count({ where: { date: todayUTC, status: "PRESENT" } }),
      prisma.project.count({ where: { status: "ACTIVE" } }),
      // Oldest submissions first — the queue is what's been waiting longest.
      prisma.vendor.findMany({
        where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: { id: true, companyName: true, status: true, createdAt: true },
      }),
    ]);

  const departments: Dept[] = [
    {
      label: "Supply Chain",
      href: "/scm",
      icon: <Building2 className="h-5 w-5" />,
      desc: "Vendor master — invitations, registrations and KYC review.",
      live: true,
      stats: [`${vendors} vendors`, `${awaiting} awaiting review`],
    },
    {
      label: "Human Resources",
      href: "/hr",
      icon: <Users className="h-5 w-5" />,
      desc: "Employee master, attendance, payroll and project staffing.",
      live: true,
      stats: [`${activeEmployees} active staff`, `${activeProjects} projects`],
    },
    {
      label: "Business Development",
      href: "/bd",
      icon: <Briefcase className="h-5 w-5" />,
      desc: "Leads, quotations and order confirmation.",
      live: false,
    },
    {
      label: "Project",
      href: "/project",
      icon: <HardHat className="h-5 w-5" />,
      desc: "BOM, scheduling, deployment and billing.",
      live: false,
    },
    {
      label: "Finance",
      href: "/finance",
      icon: <Wallet className="h-5 w-5" />,
      desc: "Invoices, payments and reconciliation.",
      live: false,
    },
  ];

  return (
    <>
      <BrandHero
        variant="mint"
        size="sm"
        wave={false}
        eyebrow="GNE ERP"
        title="Overview"
        subtitle="Every department at a glance."
        className="px-6 pb-7 pt-9 sm:px-8"
      />

      <div className="space-y-6 p-6 sm:p-8">
        {/* Cross-department pulse */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Vendors"
            value={vendors}
            tone="brand"
            icon={<Building2 className="h-[18px] w-[18px]" />}
            href="/scm/vendors"
          />
          <StatCard
            label="Awaiting review"
            value={awaiting}
            tone="amber"
            icon={<Clock className="h-[18px] w-[18px]" />}
            href="/scm/vendors?status=SUBMITTED"
          />
          <StatCard
            label="Active employees"
            value={activeEmployees}
            tone="emerald"
            icon={<Users className="h-[18px] w-[18px]" />}
            href="/hr/employees?status=ACTIVE"
          />
          <StatCard
            label="Present today"
            value={presentToday}
            tone="blue"
            icon={<CalendarCheck className="h-[18px] w-[18px]" />}
            href="/hr/attendance"
          />
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          {/* Review queue — the actionable part of oversight */}
          <Card className="lg:col-span-2">
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Clock className="h-[18px] w-[18px] text-brand" />
                  Vendor review queue
                </span>
              }
              subtitle="Longest-waiting submissions first."
              action={
                awaiting > 0 ? (
                  <Link
                    href="/scm/vendors?status=SUBMITTED"
                    className="press inline-flex items-center gap-1 text-sm font-medium text-brand-700 transition-colors hover:text-brand"
                  >
                    View all
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : undefined
              }
            />
            {reviewQueue.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-6 w-6" />}
                title="All clear"
                description="No vendor submissions are waiting for review."
              />
            ) : (
              <CardBody className="pt-2">
                <ul className="divide-y divide-slate-100">
                  {reviewQueue.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-3">
                      <EntityLink href={`/scm/vendors/${v.id}`} name={v.companyName} />
                      <span className="flex items-center gap-3">
                        <span className="nums text-xs text-slate-400">since {fmtDate(v.createdAt)}</span>
                        <StatusChip status={v.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            )}
          </Card>

          {/* Invitations funnel */}
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Mail className="h-[18px] w-[18px] text-brand" />
                  Invitations
                </span>
              }
              subtitle="Vendor onboarding funnel."
            />
            <CardBody className="space-y-4">
              <div>
                <div className="nums text-3xl font-semibold text-slate-900">{pendingInvites}</div>
                <div className="mt-0.5 text-sm text-slate-500">
                  open invitation{pendingInvites === 1 ? "" : "s"} awaiting registration
                </div>
              </div>
              <Link href="/scm/invites" className={btn("secondary", "sm")}>
                Manage invitations
                <ChevronRight className="h-4 w-4" />
              </Link>
            </CardBody>
          </Card>
        </div>

        {/* Department directory */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Departments
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((d) => (
              <DepartmentCard key={d.label} d={d} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
