import { Suspense } from "react";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { PageHeader, Skeleton } from "@/components/ui";
import {
  ManpowerKpis,
  DashboardDepartments,
  DashboardProjects,
  DashboardNotDeployed,
} from "@/components/hr/DashboardComposition";

export const dynamic = "force-dynamic";

// Compact single-screen manpower dashboard (client requirement): today's
// headcount KPIs by category, then department-wise / project-wise / not-yet-
// deployed boxes. Each cell streams via its own Suspense boundary.
export default async function HrPage() {
  await requirePageRole(HR_VIEW);

  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  return (
    <>
      <PageHeader
        title="HR Dashboard"
        subtitle="Today's manpower — by category, department and project."
      />
      <div className="space-y-4 p-4 sm:p-6">
        <Suspense fallback={<Skeleton className="h-24 w-full rounded-2xl" />}>
          <ManpowerKpis todayUTC={todayUTC} />
        </Suspense>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Suspense fallback={<Skeleton className="h-80 w-full rounded-2xl" />}>
            <DashboardDepartments />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-80 w-full rounded-2xl" />}>
            <DashboardProjects today={todayUTC} />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-80 w-full rounded-2xl" />}>
            <DashboardNotDeployed today={todayUTC} />
          </Suspense>
        </div>
      </div>
    </>
  );
}
