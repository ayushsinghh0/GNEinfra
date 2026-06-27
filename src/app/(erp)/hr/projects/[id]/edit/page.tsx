import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_WRITE } from "@/lib/rbac";
import { PageHeader, Card, CardBody } from "@/components/ui";
import ProjectForm from "@/components/hr/ProjectForm";

export const dynamic = "force-dynamic";

function toDateStr(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(HR_WRITE);
  const { id } = await params;

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();

  const initial = {
    name: project.name,
    code: project.code,
    client: project.client ?? "",
    status: project.status,
    startDate: toDateStr(project.startDate),
    endDate: toDateStr(project.endDate),
  };

  return (
    <>
      <PageHeader title={`Edit — ${project.name}`} subtitle={project.code} />
      <div className="p-8">
        <Card>
          <CardBody>
            <ProjectForm id={id} initial={initial} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
