import { requirePageRole, HR_WRITE } from "@/lib/rbac";
import { PageHeader, Card, CardBody } from "@/components/ui";
import EmployeeForm from "@/components/hr/EmployeeForm";

export const dynamic = "force-dynamic";

// Prefill from a "Convert to employee" link on a hired candidate — only the
// whitelisted, known-safe fields are seeded; everything else uses the form defaults.
export default async function NewEmployeePage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; mailId?: string; designation?: string; band?: string }>;
}) {
  await requirePageRole(HR_WRITE);
  const sp = await searchParams;
  const prefill: Record<string, string> = {};
  if (sp.name?.trim()) prefill.name = sp.name.trim();
  if (sp.mailId?.trim()) prefill.mailId = sp.mailId.trim();
  if (sp.designation?.trim()) prefill.designation = sp.designation.trim();
  if (sp.band?.trim()) prefill.band = sp.band.trim();
  const hasPrefill = Object.keys(prefill).length > 0;

  return (
    <>
      <PageHeader title="Add employee" subtitle={hasPrefill ? "Prefilled from candidate — review and complete" : undefined} />
      <div className="p-8">
        <Card>
          <CardBody>
            <EmployeeForm initial={hasPrefill ? prefill : undefined} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
