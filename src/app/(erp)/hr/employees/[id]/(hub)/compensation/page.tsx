import { redirect } from "next/navigation";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// Compensation moved off the employee hub to the Payroll page (/hr/payroll/[id]).
// Kept as a redirect so old links/bookmarks still land on the pay details.
export default async function EmployeeCompensationRedirect({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole(HR_VIEW);
  const { id } = await params;
  redirect(`/hr/payroll/${id}`);
}
