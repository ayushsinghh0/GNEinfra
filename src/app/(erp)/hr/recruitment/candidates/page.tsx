import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Users, Briefcase } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { fmtDateOnly } from "@/lib/format";
import { PageHeader, Card, CardBody, EmptyState, EntityLink, StatusChip, btn } from "@/components/ui";
import { DataTable, type Column } from "@/components/DataTable";
import { HIRING_STAGES, CANDIDATE_SOURCES } from "@/lib/recruitment-validation";
import RecruitmentSearch from "@/components/hr/RecruitmentSearch";
import CandidateFilters from "@/components/hr/CandidateFilters";

export const dynamic = "force-dynamic";

const STAGES = new Set<string>(HIRING_STAGES);
const SOURCES = new Set<string>(CANDIDATE_SOURCES);

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string; source?: string; positionId?: string }>;
}) {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);
  const { q, stage, source, positionId } = await searchParams;

  const where: Prisma.CandidateWhereInput = {};
  if (stage && STAGES.has(stage)) where.stage = stage as Prisma.CandidateWhereInput["stage"];
  if (source && SOURCES.has(source)) where.source = source;
  if (positionId && positionId.trim()) where.positionId = positionId.trim();
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term, mode: "insensitive" } },
    ];
  }

  const [candidates, positions] = await Promise.all([
    prisma.candidate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { position: { select: { id: true, title: true, code: true } } },
    }),
    prisma.jobPosition.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);

  const hasFilters = Boolean((q && q.trim()) || stage || source || positionId);

  type Row = (typeof candidates)[number];
  const columns: Column<Row>[] = [
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
    {
      key: "position",
      header: "Position",
      cardLabel: "Position",
      cell: (c) =>
        c.position ? (
          <span className="relative z-10">
            <EntityLink href={`/hr/recruitment/positions/${c.position.id}`} name={c.position.title} code={c.position.code ?? undefined} avatar={false} icon={<Briefcase className="h-4 w-4" />} />
          </span>
        ) : "—",
    },
    { key: "source", header: "Source", priority: "lg", cardLabel: "Source", cell: (c) => c.source ?? "—" },
    { key: "stage", header: "Stage", cardLabel: "Stage", cell: (c) => <span className="relative z-10"><StatusChip status={c.stage} /></span> },
    { key: "cv", header: "CV", priority: "lg", cardLabel: "CV", cell: (c) => (c.cvReceived ? "Received" : "—") },
    { key: "applied", header: "Applied", priority: "xl", cardLabel: "Applied", cell: (c) => <span className="nums">{fmtDateOnly(c.appliedOn) ?? "—"}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Candidates"
        subtitle={`${candidates.length} candidate(s)`}
        breadcrumbs={[{ label: "HR", href: "/hr" }, { label: "Recruitment", href: "/hr/recruitment" }, { label: "Candidates" }]}
      >
        {canWrite && (
          <Link href="/hr/recruitment/candidates/new" className={btn("primary", "sm")}>
            + Add candidate
          </Link>
        )}
      </PageHeader>

      <div className="space-y-6 p-8">
        <Card>
          <CardBody className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
            <RecruitmentSearch basePath="/hr/recruitment/candidates" placeholder="Search name, email or phone…" />
            <CandidateFilters positions={positions} />
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <DataTable
            rows={candidates}
            columns={columns}
            rowKey={(c) => c.id}
            href={(c) => `/hr/recruitment/candidates/${c.id}`}
            empty={
              <EmptyState
                icon={<Users className="h-6 w-6" />}
                title={hasFilters ? "No candidates found" : "No candidates yet"}
                description={hasFilters ? "Try a different search or filter." : "Add a candidate to start sourcing."}
                action={
                  hasFilters ? (
                    <Link href="/hr/recruitment/candidates" className={btn("secondary", "sm")}>Clear filters</Link>
                  ) : canWrite ? (
                    <Link href="/hr/recruitment/candidates/new" className={btn("primary", "sm")}>+ Add candidate</Link>
                  ) : undefined
                }
              />
            }
          />
        </Card>
      </div>
    </>
  );
}
