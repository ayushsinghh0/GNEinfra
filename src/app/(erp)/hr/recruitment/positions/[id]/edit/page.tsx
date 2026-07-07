import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_WRITE } from "@/lib/rbac";
import { PageHeader, Card, CardBody } from "@/components/ui";
import PositionForm from "@/components/hr/PositionForm";

export const dynamic = "force-dynamic";

export default async function EditPositionPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole(HR_WRITE);
  const { id } = await params;
  const p = await prisma.jobPosition.findUnique({ where: { id } });
  if (!p) notFound();

  const initial = {
    title: p.title,
    code: p.code ?? "",
    department: p.department ?? "",
    band: p.band ?? "",
    location: p.location ?? "",
    employmentType: p.employmentType ?? "",
    openings: String(p.openings),
    jobDescription: p.jobDescription ?? "",
    status: p.status,
  };

  return (
    <>
      <PageHeader
        title={`Edit — ${p.title}`}
        breadcrumbs={[
          { label: "HR", href: "/hr" },
          { label: "Recruitment", href: "/hr/recruitment" },
          { label: "Positions", href: "/hr/recruitment/positions" },
          { label: p.title, href: `/hr/recruitment/positions/${id}` },
          { label: "Edit" },
        ]}
      />
      <div className="p-8">
        <Card>
          <CardBody>
            {/* key={id}: remount on position-to-position edit so the mount-seeded state can't leak. */}
            <PositionForm key={id} id={id} initial={initial} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
