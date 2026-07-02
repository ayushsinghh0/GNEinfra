import { Suspense } from "react";
import Link from "next/link";
import { Mail, Clock, CheckCircle, CalendarX, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, VENDOR_VIEW } from "@/lib/rbac";
import { fmtDate } from "@/lib/format";
import InviteForm from "@/components/InviteForm";
import SavedViewPills from "@/components/hr/SavedViewPills";
import { DataTable, type Column } from "@/components/DataTable";
import {
  PageHeader,
  Card,
  EmptyState,
  EntityLink,
  StatusChip,
  StatCard,
  btn,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["PENDING", "USED", "EXPIRED", "REVOKED"]);

export default async function InvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requirePageRole(VENDOR_VIEW);

  const { status } = await searchParams;
  const filter = status && VALID_STATUS.has(status) ? status : undefined;

  const invites = await prisma.vendorInvite.findMany({
    orderBy: { sentAt: "desc" },
    include: { vendor: { select: { id: true, companyName: true } } },
  });

  // A PENDING invite past its expiry displays as EXPIRED — same derivation the
  // register route applies when a vendor follows a stale link.
  const now = new Date();
  const rows = invites.map((inv) => ({
    ...inv,
    displayStatus:
      inv.status === "PENDING" && inv.expiresAt && inv.expiresAt < now
        ? "EXPIRED"
        : inv.status,
  }));

  const countOf = (s: string) => rows.filter((r) => r.displayStatus === s).length;
  const counts = {
    PENDING: countOf("PENDING"),
    USED: countOf("USED"),
    EXPIRED: countOf("EXPIRED"),
    REVOKED: countOf("REVOKED"),
  };

  const visible = filter ? rows.filter((r) => r.displayStatus === filter) : rows;

  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    {
      key: "email",
      header: "Email",
      titleInCard: true,
      cell: (r) => <span className="font-medium text-slate-900">{r.email}</span>,
    },
    {
      key: "hint",
      header: "Company hint",
      priority: "lg",
      cardLabel: "Company",
      cell: (r) => r.companyHint || <span className="text-slate-400">—</span>,
    },
    {
      key: "sent",
      header: "Sent",
      priority: "md",
      cardLabel: "Sent",
      cell: (r) => <span className="nums text-slate-500">{fmtDate(r.sentAt)}</span>,
    },
    {
      key: "expires",
      header: "Expires",
      priority: "lg",
      cardLabel: "Expires",
      cell: (r) => (
        <span className={r.displayStatus === "EXPIRED" ? "nums text-amber-600" : "nums text-slate-500"}>
          {fmtDate(r.expiresAt) || "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cardLabel: "Status",
      cell: (r) => <StatusChip status={r.displayStatus} />,
    },
    {
      key: "vendor",
      header: "Registration",
      cardLabel: "Registration",
      cell: (r) =>
        r.vendor ? (
          <span className="relative z-10">
            <EntityLink href={`/scm/vendors/${r.vendor.id}`} name={r.vendor.companyName} avatar={false} />
          </span>
        ) : (
          <span className="text-xs text-slate-400">Not registered yet</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Invitations"
        subtitle={filter ? `${visible.length} of ${rows.length}` : `${rows.length} total`}
        breadcrumbs={[{ label: "SCM", href: "/scm" }, { label: "Invitations" }]}
      />

      <div className="space-y-6 p-6 sm:p-8">
        {/* Funnel at a glance — each card filters the list below. */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Pending"
            value={counts.PENDING}
            tone="amber"
            icon={<Clock className="h-[18px] w-[18px]" />}
            href="/scm/invites?status=PENDING"
          />
          <StatCard
            label="Registered"
            value={counts.USED}
            tone="emerald"
            icon={<CheckCircle className="h-[18px] w-[18px]" />}
            href="/scm/invites?status=USED"
          />
          <StatCard
            label="Expired"
            value={counts.EXPIRED}
            tone="slate"
            icon={<CalendarX className="h-[18px] w-[18px]" />}
            href="/scm/invites?status=EXPIRED"
          />
          <StatCard
            label="Revoked"
            value={counts.REVOKED}
            tone="rose"
            icon={<XCircle className="h-[18px] w-[18px]" />}
            href="/scm/invites?status=REVOKED"
          />
        </div>

        <InviteForm />

        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <Suspense fallback={<div className="h-8" />}>
              <SavedViewPills
                basePath="/scm/invites"
                views={[
                  { value: "", label: "All" },
                  { value: "PENDING", label: "Pending" },
                  { value: "USED", label: "Registered" },
                  { value: "EXPIRED", label: "Expired" },
                  { value: "REVOKED", label: "Revoked" },
                ]}
              />
            </Suspense>
          </div>
          <DataTable
            rows={visible}
            columns={columns}
            rowKey={(r) => r.id}
            empty={
              <EmptyState
                icon={<Mail className="h-6 w-6" />}
                title={filter ? "No invitations here" : "No invitations sent yet"}
                description={
                  filter
                    ? "No invitations match this view."
                    : "Invite a vendor above to send them a unique registration link."
                }
                action={
                  filter ? (
                    <Link href="/scm/invites" className={btn("secondary", "sm")}>
                      Show all
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
