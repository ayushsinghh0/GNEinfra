import { Suspense } from "react";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, BD_VIEW, BD_WRITE } from "@/lib/rbac";
import { BD_STAGES } from "@/lib/bd-validation";
import { statusMeta } from "@/lib/hr-status";
import { fmtDateOnly, fmtINR } from "@/lib/format";
import SavedViewPills from "@/components/hr/SavedViewPills";
import ListSearch from "@/components/bd/ListSearch";
import { DataTable, type Column } from "@/components/DataTable";
import {
  PageHeader,
  Card,
  CardBody,
  EmptyState,
  EntityLink,
  StatusChip,
  btn,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const VALID_FINAL = new Set(["OPEN", "WON", "LOST"]);
const VALID_STAGE = new Set<string>(BD_STAGES);

export default async function BdEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; stage?: string; fy?: string }>;
}) {
  const viewer = await requirePageRole(BD_VIEW);
  const canWrite = BD_WRITE.includes(viewer.role);

  const { q, status, stage, fy } = await searchParams;

  const where: Prisma.BdEnquiryWhereInput = {};
  if (status && VALID_FINAL.has(status)) {
    where.finalStatus = status as Prisma.BdEnquiryWhereInput["finalStatus"];
  }
  if (stage && VALID_STAGE.has(stage)) {
    where.stage = stage as Prisma.BdEnquiryWhereInput["stage"];
  }
  if (fy && fy.trim()) {
    where.fiscalYear = fy.trim();
  }
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { client: { name: { contains: term, mode: "insensitive" } } },
      { quoteNo: { contains: term, mode: "insensitive" } },
      { location: { contains: term, mode: "insensitive" } },
      { personName: { contains: term, mode: "insensitive" } },
      { projectType: { contains: term, mode: "insensitive" } },
    ];
  }

  const [enquiries, fyRows] = await Promise.all([
    prisma.bdEnquiry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { client: { select: { id: true, name: true } } },
    }),
    prisma.bdEnquiry.findMany({ distinct: ["fiscalYear"], select: { fiscalYear: true }, orderBy: { fiscalYear: "desc" } }),
  ]);

  const hasFilters = Boolean(
    (q && q.trim()) || (status && VALID_FINAL.has(status)) || (stage && VALID_STAGE.has(stage)) || (fy && fy.trim())
  );

  type Row = (typeof enquiries)[number];
  const columns: Column<Row>[] = [
    {
      key: "client",
      header: "Client",
      titleInCard: true,
      cell: (e) => (
        <span className="relative z-10">
          <EntityLink href={`/bd/enquiries/${e.id}`} name={e.client.name} code={e.quoteNo ?? undefined} />
        </span>
      ),
    },
    {
      key: "project",
      header: "Project",
      priority: "md",
      cardLabel: "Project",
      cell: (e) => e.projectType ?? e.activities ?? "—",
    },
    {
      key: "value",
      header: "Value",
      align: "right",
      cardLabel: "Value",
      cell: (e) => <span className="nums">{fmtINR(e.value)}</span>,
    },
    {
      key: "prob",
      header: "Prob.",
      align: "right",
      priority: "lg",
      cardLabel: "Probability",
      cell: (e) => <span className="nums">{e.probabilityPct !== null ? `${e.probabilityPct}%` : "—"}</span>,
    },
    {
      key: "stage",
      header: "Stage",
      cardLabel: "Stage",
      cell: (e) => (
        <span className="relative z-10">
          <StatusChip status={e.stage} />
        </span>
      ),
    },
    {
      key: "final",
      header: "Outcome",
      priority: "lg",
      cardLabel: "Outcome",
      cell: (e) => (
        <span className="relative z-10">
          <StatusChip status={e.finalStatus} />
        </span>
      ),
    },
    {
      key: "date",
      header: "Date",
      priority: "xl",
      cardLabel: "Date",
      cell: (e) => <span className="nums text-slate-500">{fmtDateOnly(e.enquiryDate) ?? "—"}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Enquiries & Quotes"
        subtitle={`${enquiries.length} result(s)`}
        breadcrumbs={[{ label: "BD", href: "/bd" }, { label: "Enquiries & Quotes" }]}
      >
        {canWrite && (
          <Link href="/bd/enquiries/new" className={btn("primary", "sm")}>
            + New enquiry
          </Link>
        )}
      </PageHeader>

      <div className="p-8 space-y-6">
        <Card>
          <CardBody className="space-y-3 p-4">
            <SavedViewPills
              basePath="/bd/enquiries"
              views={[
                { value: "", label: "All" },
                { value: "OPEN", label: "Open" },
                { value: "WON", label: "Won" },
                { value: "LOST", label: "Lost" },
              ]}
            />
            <Suspense fallback={<div className="h-10" />}>
              <ListSearch
                basePath="/bd/enquiries"
                placeholder="Search client, quote no, location or person…"
                ariaLabel="Search enquiries"
                selects={[
                  {
                    param: "stage",
                    ariaLabel: "Filter by stage",
                    allLabel: "All stages",
                    options: BD_STAGES.map((s) => ({ value: s, label: statusMeta(s).label })),
                  },
                  {
                    param: "fy",
                    ariaLabel: "Filter by fiscal year",
                    allLabel: "All years",
                    options: fyRows.map((r) => ({ value: r.fiscalYear, label: r.fiscalYear })),
                  },
                ]}
              />
            </Suspense>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <DataTable
            rows={enquiries}
            columns={columns}
            rowKey={(e) => e.id}
            href={(e) => `/bd/enquiries/${e.id}`}
            empty={
              <EmptyState
                icon={<FileText className="h-6 w-6" />}
                title={hasFilters ? "No enquiries found" : "No enquiries yet"}
                description={
                  hasFilters
                    ? "No enquiries match your filters. Try widening them."
                    : "Record your first enquiry to start the Query & Quote tracker."
                }
                action={
                  hasFilters ? (
                    <Link href="/bd/enquiries" className={btn("secondary", "sm")}>
                      Clear filters
                    </Link>
                  ) : canWrite ? (
                    <Link href="/bd/enquiries/new" className={btn("primary", "sm")}>
                      + New enquiry
                    </Link>
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
