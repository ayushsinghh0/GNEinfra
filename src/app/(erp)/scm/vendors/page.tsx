import { Suspense } from "react";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Building2, FileText, Send, Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, VENDOR_VIEW, VENDOR_WRITE } from "@/lib/rbac";
import { fmtDate } from "@/lib/format";
import VendorSearch from "@/components/VendorSearch";
import SavedViewPills from "@/components/hr/SavedViewPills";
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

const VALID_STATUS = new Set(["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"]);

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const viewer = await requirePageRole(VENDOR_VIEW);
  const canWrite = VENDOR_WRITE.includes(viewer.role);

  const { q, status } = await searchParams;

  const where: Prisma.VendorWhereInput = {};
  if (status && VALID_STATUS.has(status)) {
    where.status = status as Prisma.VendorWhereInput["status"];
  }
  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { companyName: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { gstNo: { contains: term, mode: "insensitive" } },
      { panNo: { contains: term, mode: "insensitive" } },
      { contactPerson: { contains: term, mode: "insensitive" } },
    ];
  }

  const vendors = await prisma.vendor.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { services: true, documents: true } } },
  });

  const hasFilters = Boolean((q && q.trim()) || (status && VALID_STATUS.has(status)));

  type Vendor = (typeof vendors)[number];
  const columns: Column<Vendor>[] = [
    {
      key: "company",
      header: "Company",
      titleInCard: true,
      cell: (v) => (
        <span className="relative z-10">
          <EntityLink
            href={`/scm/vendors/${v.id}`}
            name={v.companyName}
            code={v.vendorCode ?? undefined}
          />
        </span>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      priority: "lg",
      cardLabel: "Contact",
      cell: (v) => v.contactPerson || "—",
    },
    {
      key: "email",
      header: "Email",
      priority: "md",
      cardLabel: "Email",
      cell: (v) => <span className="text-slate-600">{v.email}</span>,
    },
    {
      key: "ids",
      header: "GST / PAN",
      priority: "xl",
      cardLabel: "GST / PAN",
      cell: (v) =>
        v.gstNo || v.panNo ? (
          <span className="block leading-tight">
            <span className="nums block truncate font-mono text-xs text-slate-600">{v.gstNo || "—"}</span>
            <span className="nums block truncate font-mono text-xs text-slate-400">{v.panNo || "—"}</span>
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "activity",
      header: "Activity",
      priority: "lg",
      cardLabel: "Activity",
      cell: (v) => (
        <span className="inline-flex items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1" title={`${v._count.services} service(s)`}>
            <Wrench className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            {v._count.services}
          </span>
          <span className="inline-flex items-center gap-1" title={`${v._count.documents} document(s)`}>
            <FileText className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            {v._count.documents}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cardLabel: "Status",
      cell: (v) => <StatusChip status={v.status} />,
    },
    {
      key: "submitted",
      header: "Submitted",
      priority: "md",
      cardLabel: "Submitted",
      cell: (v) => <span className="nums text-slate-500">{fmtDate(v.createdAt)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Vendors"
        subtitle={`${vendors.length} result(s)`}
        breadcrumbs={[{ label: "SCM", href: "/scm" }, { label: "Vendors" }]}
      >
        {canWrite && (
          <Link href="/scm/invites" className={btn("primary", "sm")}>
            <Send className="h-4 w-4" />
            Invite vendor
          </Link>
        )}
      </PageHeader>

      <div className="space-y-6 p-6 sm:p-8">
        <Card>
          <CardBody className="space-y-3 p-4">
            <Suspense fallback={<div className="h-8" />}>
              <SavedViewPills
                basePath="/scm/vendors"
                views={[
                  { value: "", label: "All" },
                  { value: "SUBMITTED", label: "Submitted" },
                  { value: "UNDER_REVIEW", label: "Under review" },
                  { value: "APPROVED", label: "Approved" },
                  { value: "REJECTED", label: "Rejected" },
                ]}
              />
            </Suspense>
            <Suspense fallback={<div className="h-11" />}>
              <VendorSearch />
            </Suspense>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <DataTable
            rows={vendors}
            columns={columns}
            rowKey={(v) => v.id}
            href={(v) => `/scm/vendors/${v.id}`}
            empty={
              <EmptyState
                icon={<Building2 className="h-6 w-6" />}
                title={hasFilters ? "No vendors found" : "No vendors yet"}
                description={
                  hasFilters
                    ? "No vendors match your search. Try a different term or status."
                    : "Invite your first vendor — their registration will appear here."
                }
                action={
                  hasFilters ? (
                    <Link href="/scm/vendors" className={btn("secondary", "sm")}>
                      Clear filters
                    </Link>
                  ) : canWrite ? (
                    <Link href="/scm/invites" className={btn("primary", "sm")}>
                      <Send className="h-4 w-4" />
                      Invite a vendor
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
