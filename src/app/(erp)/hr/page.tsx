import { Suspense } from "react";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { PageHeader, Skeleton } from "@/components/ui";
import { fmtDateOnly } from "@/lib/format";
import {
  ManpowerKpis,
  DashboardDepartments,
  DashboardProjects,
  DashboardNotDeployed,
} from "@/components/hr/DashboardComposition";

export const dynamic = "force-dynamic";

// Compact single-screen manpower dashboard (client requirement): today's
// headcount KPIs by category, then department-wise / project-wise / not-yet-
// deployed boxes. Each cell streams via its own Suspense boundary; the boxes
// cap their own height and scroll internally so the page stays one screen.
export default async function HrPage() {
  await requirePageRole(HR_VIEW);

  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  return (
    <>
      <PageHeader
        title="HR Dashboard"
        subtitle={`Manpower for ${fmtDateOnly(todayUTC)} — by category, department and project.`}
      />
      <div className="space-y-3 p-4 sm:p-5">
        <Suspense
          fallback={
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-[52px] w-full rounded-xl" />
              ))}
            </div>
          }
        >
          <ManpowerKpis todayUTC={todayUTC} />
        </Suspense>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Suspense fallback={<Skeleton className="h-72 w-full rounded-2xl" />}>
            <DashboardDepartments />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-72 w-full rounded-2xl" />}>
            <DashboardProjects today={todayUTC} />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-72 w-full rounded-2xl" />}>
            <DashboardNotDeployed today={todayUTC} />
          </Suspense>
        </div>
      </div>
    </>
  );
}
