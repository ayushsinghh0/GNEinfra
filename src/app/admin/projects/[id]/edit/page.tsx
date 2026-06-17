import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { PageHeader, btn } from "@/components/ui";
import ProjectForm from "@/components/ProjectForm";

export const dynamic = "force-dynamic";

function d(v: Date | null) {
  return v ? v.toISOString().slice(0, 10) : "";
}

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdminAuthed())) return null;
  const { id } = await params;
  const p = await prisma.project.findUnique({ where: { id } });
  if (!p) notFound();

  const vendors = await prisma.vendor.findMany({
    select: { id: true, companyName: true },
    orderBy: { companyName: "asc" },
  });

  const initial = {
    gneId: p.gneId, clientName: p.clientName ?? "", tenderId: p.tenderId ?? "",
    state: p.state ?? "", district: p.district ?? "", cluster: p.cluster ?? "",
    plantName: p.plantName ?? "",
    capacityAcMw: p.capacityAcMw?.toString() ?? "", capacityDcMw: p.capacityDcMw?.toString() ?? "",
    epcScope: p.epcScope ?? "", poNumber: p.poNumber ?? "", poValueCr: p.poValueCr?.toString() ?? "",
    subPartner: p.subPartner ?? "", vendorId: p.vendorId ?? "", stage: p.stage,
    startDate: d(p.startDate), liveDate: d(p.liveDate), completeDate: d(p.completeDate),
    handoverDate: d(p.handoverDate), plantAddress: p.plantAddress ?? "", clientAddress: p.clientAddress ?? "",
  };

  return (
    <>
      <PageHeader title="Edit project" subtitle={p.gneId}>
        <Link href={`/admin/projects/${id}`} className={btn("secondary", "sm")}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </PageHeader>
      <div className="p-8 space-y-6">
        <ProjectForm vendors={vendors} mode="edit" initial={initial} projectId={id} />
      </div>
    </>
  );
}
