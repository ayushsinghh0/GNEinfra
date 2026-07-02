import { Suspense } from "react";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Building2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, BD_VIEW, BD_WRITE } from "@/lib/rbac";
import { SERVICE_TYPE_LABELS, PLANT_TYPE_LABELS } from "@/lib/bd-validation";
import SavedViewPills from "@/components/hr/SavedViewPills";
import ListSearch from "@/components/bd/ListSearch";
import { DataTable, type Column } from "@/components/DataTable";
import {
  PageHeader,
  Card,
  CardBody,
  EmptyState,
  EntityLink,
  btn,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const VALID_SERVICE = new Set(["EPC", "OM", "EPC_OM"]);

export default async function BdClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const viewer = await requirePageRole(BD_VIEW);
  const canWrite = BD_WRITE.includes(viewer.role);

  const { q, category } = await searchParams;

  const where: Prisma.BdClientWhereInput = {};
  if (category && VALID_SERVICE.has(category)) {
    where.serviceType = category as Prisma.BdClientWhereInput["serviceType"];
  }
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { industry: { contains: term, mode: "insensitive" } },
      { contactPerson: { contains: term, mode: "insensitive" } },
    ];
  }

  const clients = await prisma.bdClient.findMany({
    where,
    orderBy: { name: "asc" },
    include: { _count: { select: { enquiries: true, purchaseOrders: true } } },
  });

  const hasFilters = Boolean((q && q.trim()) || (category && VALID_SERVICE.has(category)));

  type Row = (typeof clients)[number];
  const columns: Column<Row>[] = [
    {
      key: "client",
      header: "Client",
      titleInCard: true,
      cell: (c) => (
        <span className="relative z-10">
          <EntityLink href={`/bd/clients/${c.id}`} name={c.name} />
        </span>
      ),
    },
    {
      key: "industry",
      header: "Industry",
      priority: "md",
      cardLabel: "Industry",
      cell: (c) => c.industry ?? "—",
    },
    {
      key: "service",
      header: "Service",
      cardLabel: "Service",
      cell: (c) => (c.serviceType ? SERVICE_TYPE_LABELS[c.serviceType] : "—"),
    },
    {
      key: "plant",
      header: "Plant",
      priority: "lg",
      cardLabel: "Plant",
      cell: (c) => (c.plantType ? PLANT_TYPE_LABELS[c.plantType] : "—"),
    },
    {
      key: "contact",
      header: "Contact",
      priority: "xl",
      cardLabel: "Contact",
      cell: (c) => c.contactPerson ?? "—",
    },
    {
      key: "activity",
      header: "Activity",
      priority: "lg",
      cardLabel: "Activity",
      cell: (c) => (
        <span className="nums text-xs text-slate-500">
          {c._count.enquiries} enq · {c._count.purchaseOrders} PO
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} result(s)`}
        breadcrumbs={[{ label: "BD", href: "/bd" }, { label: "Clients" }]}
      >
        {canWrite && (
          <Link href="/bd/clients/new" className={btn("primary", "sm")}>
            + Add client
          </Link>
        )}
      </PageHeader>

      <div className="p-8 space-y-6">
        <Card>
          <CardBody className="space-y-3 p-4">
            <SavedViewPills
              basePath="/bd/clients"
              param="category"
              views={[
                { value: "", label: "All" },
                { value: "EPC", label: "EPC" },
                { value: "OM", label: "O&M" },
                { value: "EPC_OM", label: "EPC / O&M" },
              ]}
            />
            <Suspense fallback={<div className="h-10" />}>
              <ListSearch
                basePath="/bd/clients"
                placeholder="Search client, industry or contact…"
                ariaLabel="Search clients"
              />
            </Suspense>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <DataTable
            rows={clients}
            columns={columns}
            rowKey={(c) => c.id}
            href={(c) => `/bd/clients/${c.id}`}
            empty={
              <EmptyState
                icon={<Building2 className="h-6 w-6" />}
                title={hasFilters ? "No clients found" : "No clients yet"}
                description={
                  hasFilters
                    ? "No clients match your search. Try a different term or filter."
                    : "Add your first client to build the BD client list."
                }
                action={
                  hasFilters ? (
                    <Link href="/bd/clients" className={btn("secondary", "sm")}>
                      Clear filters
                    </Link>
                  ) : canWrite ? (
                    <Link href="/bd/clients/new" className={btn("primary", "sm")}>
                      + Add client
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
