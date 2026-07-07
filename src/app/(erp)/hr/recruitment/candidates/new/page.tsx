import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_WRITE } from "@/lib/rbac";
import { PageHeader, Card, CardBody } from "@/components/ui";
import CandidateForm from "@/components/hr/CandidateForm";

export const dynamic = "force-dynamic";

export default async function NewCandidatePage({
  searchParams,
}: {
  searchParams: Promise<{ positionId?: string }>;
}) {
  await requirePageRole(HR_WRITE);
  const sp = await searchParams;
  const positions = await prisma.jobPosition.findMany({
    orderBy: { title: "asc" },
    select: { id: true, title: true, code: true },
  });
  const initial = sp.positionId?.trim() ? { positionId: sp.positionId.trim() } : undefined;

  return (
    <>
      <PageHeader
        title="Add candidate"
        breadcrumbs={[
          { label: "HR", href: "/hr" },
          { label: "Recruitment", href: "/hr/recruitment" },
          { label: "Candidates", href: "/hr/recruitment/candidates" },
          { label: "New" },
        ]}
      />
      <div className="p-8">
        <Card>
          <CardBody>
            <CandidateForm positions={positions} initial={initial} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
