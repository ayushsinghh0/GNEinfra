import * as React from "react";
import Link from "next/link";
import { requirePageRole, OVERSIGHT } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { BrandHero } from "@/components/chrome";
import { StatCard } from "@/components/ui";
import { Building2, Briefcase, HardHat, Wallet, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  await requirePageRole(OVERSIGHT);
  const [vendors, awaiting] = await Promise.all([
    prisma.vendor.count(),
    prisma.vendor.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
  ]);

  const depts: { label: string; href: string; icon: React.ReactNode; tone: "brand" | "amber" | "blue" | "emerald" | "slate"; value: React.ReactNode }[] = [
    { label: "Supply Chain — vendors", href: "/scm", icon: <Building2 className="h-[18px] w-[18px]" />, tone: "brand", value: vendors },
    { label: "SCM — awaiting review", href: "/scm/vendors?status=SUBMITTED", icon: <Building2 className="h-[18px] w-[18px]" />, tone: "amber", value: awaiting },
    { label: "Business Development", href: "/bd", icon: <Briefcase className="h-[18px] w-[18px]" />, tone: "blue", value: "—" },
    { label: "Project", href: "/project", icon: <HardHat className="h-[18px] w-[18px]" />, tone: "emerald", value: "—" },
    { label: "Finance", href: "/finance", icon: <Wallet className="h-[18px] w-[18px]" />, tone: "slate", value: "—" },
    { label: "Human Resources", href: "/hr", icon: <Users className="h-[18px] w-[18px]" />, tone: "slate", value: "—" },
  ];

  return (
    <>
      <BrandHero variant="mint" size="sm" wave={false} eyebrow="GNE ERP" title="Overview" subtitle="Every department at a glance." className="px-6 pb-7 pt-9 sm:px-8" />
      <div className="grid grid-cols-2 gap-4 p-6 sm:p-8 lg:grid-cols-3">
        {depts.map((d) => (
          <Link key={d.label} href={d.href} className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">
            <StatCard label={d.label} value={d.value} tone={d.tone} icon={d.icon} />
          </Link>
        ))}
      </div>
    </>
  );
}
