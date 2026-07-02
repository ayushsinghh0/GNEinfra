import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, BD_WRITE } from "@/lib/rbac";
import TargetForm from "@/components/bd/TargetForm";
import DeleteRowButton from "@/components/bd/DeleteRowButton";
import { PageHeader, Card, CardBody } from "@/components/ui";

export const dynamic = "force-dynamic";

const numStr = (n: number | null) => (n !== null ? String(n) : "");

export default async function EditBdTargetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(BD_WRITE);
  const { id } = await params;
  const target = await prisma.bdTarget.findUnique({ where: { id } });
  if (!target) notFound();

  const initial = {
    fiscalYear: target.fiscalYear,
    quarter: target.quarter ?? "",
    states: target.states ?? "",
    keyAccountPerson: target.keyAccountPerson ?? "",
    project: target.project ?? "",
    serviceType: target.serviceType ?? "",
    plantType: target.plantType ?? "",
    projectSize: target.projectSize ?? "",
    locations: numStr(target.locations),
    estimatedValue: numStr(target.estimatedValue),
    probabilityPct: numStr(target.probabilityPct),
    forecastedRevenue: numStr(target.forecastedRevenue),
    orderReceived: numStr(target.orderReceived),
    notes: target.notes ?? "",
  };

  return (
    <>
      <PageHeader
        title="Edit target"
        subtitle={`${target.fiscalYear}${target.quarter ? ` · ${target.quarter}` : ""}`}
        breadcrumbs={[
          { label: "BD", href: "/bd" },
          { label: "Targets", href: "/bd/targets" },
          { label: "Edit" },
        ]}
      >
        <DeleteRowButton
          endpoint={`/api/bd/targets/${target.id}`}
          redirectTo="/bd/targets"
          title="Delete this target line?"
          message="This permanently removes the line from the business target sheet."
          doneToast="Target deleted"
        />
      </PageHeader>
      <div className="p-8">
        <Card className="max-w-4xl">
          <CardBody>
            <TargetForm key={target.id} id={target.id} initial={initial} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
