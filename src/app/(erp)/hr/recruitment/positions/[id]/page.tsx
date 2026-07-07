import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, Users, FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { fmtDateOnly } from "@/lib/format";
import {
  PageHeader, Card, StatCard, StatusChip, EntityLink, EmptyState,
  KeyValue, DetailSection, btn,
} from "@/components/ui";
import { DataTable, type Column } from "@/components/DataTable";
import { POSITION_STATUS_LABELS } from "@/lib/recruitment-validation";
import RecruitmentDelete from "@/components/hr/RecruitmentDelete";

export const dynamic = "force-dynamic";

export default async function PositionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);
  const { id } = await params;

  const position = await prisma.jobPosition.findUnique({
    where: { id },
    include: {
      candidates: {
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, source: true, stage: true, cvReceived: true, appliedOn: true },
      },
    },
  });
  if (!position) notFound();

  const hired = position.candidates.filter((c) => c.stage === "HIRED").length;

  type Cand = (typeof position.candidates)[number];
  const columns: Column<Cand>[] = [
    {
      key: "name",
      header: "Candidate",
      titleInCard: true,
      cell: (c) => (
        <span className="relative z-10">
          <EntityLink href={`/hr/recruitment/candidates/${c.id}`} name={c.name} avatar={false} icon={<Users className="h-4 w-4" />} />
        </span>
      ),
    },
    { key: "source", header: "Source", cardLabel: "Source", cell: (c) => c.source ?? "—" },
    { key: "stage", header: "Stage", cardLabel: "Stage", cell: (c) => <span className="relative z-10"><StatusChip status={c.stage} /></span> },
    { key: "cv", header: "CV", priority: "lg", cardLabel: "CV", cell: (c) => (c.cvReceived ? "Received" : "—") },
    { key: "applied", header: "Applied", priority: "lg", cardLabel: "Applied", cell: (c) => <span className="nums">{fmtDateOnly(c.appliedOn) ?? "—"}</span> },
  ];

  return (
    <>
      <PageHeader
        title={position.title}
        subtitle={position.code ?? undefined}
        breadcrumbs={[
          { label: "HR", href: "/hr" },
          { label: "Recruitment", href: "/hr/recruitment" },
          { label: "Positions", href: "/hr/recruitment/positions" },
          { label: position.title },
        ]}
      >
        <StatusChip status={position.status} />
        {canWrite && (
          <>
            <Link href={`/hr/recruitment/positions/${id}/edit`} className={btn("secondary", "sm")}>Edit</Link>
            <RecruitmentDelete
              endpoint={`/api/hr/recruitment/positions/${id}`}
              redirectTo="/hr/recruitment/positions"
              label="position"
              message={`Delete "${position.title}"? Candidates sourced against it are kept, but unlinked from this position.`}
            />
          </>
        )}
      </PageHeader>

      <div className="space-y-6 p-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Openings" value={position.openings} tone="brand" icon={<Briefcase className="h-4 w-4" />} />
          <StatCard label="Hired" value={hired} tone="emerald" icon={<Users className="h-4 w-4" />} />
          <StatCard label="Candidates" value={position.candidates.length} tone="blue" icon={<Users className="h-4 w-4" />} />
          <StatCard label="Status" value={POSITION_STATUS_LABELS[position.status]} tone="amber" icon={<FileText className="h-4 w-4" />} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DetailSection title="Position details" icon={<Briefcase className="h-4 w-4 text-slate-400" />}>
            <KeyValue
              items={[
                { label: "Department", value: position.department },
                { label: "Band", value: position.band },
                { label: "Location", value: position.location },
                { label: "Employment type", value: position.employmentType },
                { label: "Openings", value: String(position.openings) },
              ]}
            />
          </DetailSection>

          <DetailSection title="Job description" icon={<FileText className="h-4 w-4 text-slate-400" />}>
            {position.jobDescription ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{position.jobDescription}</p>
            ) : (
              <p className="text-sm text-slate-400">No job description yet.</p>
            )}
          </DetailSection>
        </div>

        <DetailSection
          title="Candidates"
          icon={<Users className="h-4 w-4 text-slate-400" />}
          action={
            canWrite ? (
              <Link href={`/hr/recruitment/candidates/new?positionId=${id}`} className={btn("primary", "sm")}>
                + Add candidate
              </Link>
            ) : undefined
          }
        >
          <Card className="overflow-hidden">
            <DataTable
              rows={position.candidates}
              columns={columns}
              rowKey={(c) => c.id}
              href={(c) => `/hr/recruitment/candidates/${c.id}`}
              empty={<EmptyState icon={<Users className="h-6 w-6" />} title="No candidates yet" description="Add a candidate to start the pipeline for this role." />}
            />
          </Card>
        </DetailSection>
      </div>
    </>
  );
}
