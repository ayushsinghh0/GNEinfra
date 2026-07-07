import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Briefcase } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { PageHeader, Card, CardBody, EmptyState, EntityLink, StatusChip, btn } from "@/components/ui";
import { DataTable, type Column } from "@/components/DataTable";
import { POSITION_STATUS_LABELS } from "@/lib/recruitment-validation";
import RecruitmentSearch from "@/components/hr/RecruitmentSearch";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["OPEN", "ON_HOLD", "CLOSED"]);

export default async function PositionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);
  const { q, status } = await searchParams;

  const where: Prisma.JobPositionWhereInput = {};
  if (status && VALID_STATUS.has(status)) {
    where.status = status as Prisma.JobPositionWhereInput["status"];
  }
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { code: { contains: term, mode: "insensitive" } },
      { department: { contains: term, mode: "insensitive" } },
    ];
  }

  const positions = await prisma.jobPosition.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { candidates: { select: { stage: true } } },
  });

  const hasFilters = Boolean((q && q.trim()) || (status && VALID_STATUS.has(status)));

  type Row = (typeof positions)[number];
  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Role / Position",
      titleInCard: true,
      cell: (p) => (
        <span className="relative z-10">
          <EntityLink href={`/hr/recruitment/positions/${p.id}`} name={p.title} code={p.code ?? undefined} avatar={false} icon={<Briefcase className="h-4 w-4" />} />
        </span>
      ),
    },
    { key: "department", header: "Department", cardLabel: "Department", cell: (p) => p.department ?? "—" },
    { key: "band", header: "Band", priority: "lg", cardLabel: "Band", cell: (p) => p.band ?? "—" },
    { key: "openings", header: "Openings", cardLabel: "Openings", cell: (p) => <span className="nums">{p.openings}</span> },
    {
      key: "filled",
      header: "Hired",
      priority: "lg",
      cardLabel: "Hired",
      cell: (p) => {
        const hired = p.candidates.filter((c) => c.stage === "HIRED").length;
        return <span className="nums">{hired} / {p.openings}</span>;
      },
    },
    {
      key: "candidates",
      header: "Candidates",
      priority: "lg",
      cardLabel: "Candidates",
      cell: (p) => <span className="nums">{p.candidates.length}</span>,
    },
    {
      key: "status",
      header: "Status",
      cardLabel: "Status",
      cell: (p) => <span className="relative z-10"><StatusChip status={p.status} /></span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Positions"
        subtitle={`${positions.length} position(s)`}
        breadcrumbs={[{ label: "HR", href: "/hr" }, { label: "Recruitment", href: "/hr/recruitment" }, { label: "Positions" }]}
      >
        {canWrite && (
          <Link href="/hr/recruitment/positions/new" className={btn("primary", "sm")}>
            + Add position
          </Link>
        )}
      </PageHeader>

      <div className="space-y-6 p-8">
        <Card>
          <CardBody className="space-y-3 p-4">
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: "", label: "All" },
                { value: "OPEN", label: POSITION_STATUS_LABELS.OPEN },
                { value: "ON_HOLD", label: POSITION_STATUS_LABELS.ON_HOLD },
                { value: "CLOSED", label: POSITION_STATUS_LABELS.CLOSED },
              ].map((v) => {
                const href = v.value ? `/hr/recruitment/positions?status=${v.value}` : "/hr/recruitment/positions";
                const active = (status ?? "") === v.value;
                return (
                  <Link
                    key={v.label}
                    href={href}
                    className={active ? btn("primary", "sm") : btn("ghost", "sm")}
                  >
                    {v.label}
                  </Link>
                );
              })}
            </div>
            <RecruitmentSearch basePath="/hr/recruitment/positions" placeholder="Search title, code or department…" />
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <DataTable
            rows={positions}
            columns={columns}
            rowKey={(p) => p.id}
            href={(p) => `/hr/recruitment/positions/${p.id}`}
            empty={
              <EmptyState
                icon={<Briefcase className="h-6 w-6" />}
                title={hasFilters ? "No positions found" : "No positions yet"}
                description={hasFilters ? "Try a different search or status." : "Add your first open role to start sourcing."}
                action={
                  hasFilters ? (
                    <Link href="/hr/recruitment/positions" className={btn("secondary", "sm")}>Clear filters</Link>
                  ) : canWrite ? (
                    <Link href="/hr/recruitment/positions/new" className={btn("primary", "sm")}>+ Add position</Link>
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
