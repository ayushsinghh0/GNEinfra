import { redirect } from "next/navigation";

// The Payroll tab was retired with the payroll module (2026-07 ERP change
// request); pay details live on the Compensation tab. Kept as a redirect so
// old bookmarks and deep links don't 404.
export default async function LegacyPayrollTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/hr/employees/${id}/compensation`);
}
