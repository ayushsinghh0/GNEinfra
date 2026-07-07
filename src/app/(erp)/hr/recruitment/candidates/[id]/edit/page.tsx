import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_WRITE } from "@/lib/rbac";
import { PageHeader, Card, CardBody } from "@/components/ui";
import CandidateForm from "@/components/hr/CandidateForm";

export const dynamic = "force-dynamic";

function toDateStr(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function EditCandidatePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole(HR_WRITE);
  const { id } = await params;
  const [c, positions] = await Promise.all([
    prisma.candidate.findUnique({ where: { id } }),
    prisma.jobPosition.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true, code: true } }),
  ]);
  if (!c) notFound();

  const initial = {
    name: c.name,
    email: c.email ?? "",
    phone: c.phone ?? "",
    positionId: c.positionId ?? "",
    source: c.source ?? "",
    stage: c.stage,
    cvLink: c.cvLink ?? "",
    experienceYears: c.experienceYears != null ? String(c.experienceYears) : "",
    noticePeriod: c.noticePeriod ?? "",
    appliedOn: toDateStr(c.appliedOn),
    notes: c.notes ?? "",
  };

  return (
    <>
      <PageHeader
        title={`Edit — ${c.name}`}
        breadcrumbs={[
          { label: "HR", href: "/hr" },
          { label: "Recruitment", href: "/hr/recruitment" },
          { label: "Candidates", href: "/hr/recruitment/candidates" },
          { label: c.name, href: `/hr/recruitment/candidates/${id}` },
          { label: "Edit" },
        ]}
      />
      <div className="p-8">
        <Card>
          <CardBody>
            <CandidateForm key={id} id={id} initial={initial} initialCvReceived={c.cvReceived} positions={positions} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
