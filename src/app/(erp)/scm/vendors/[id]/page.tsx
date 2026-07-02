import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, VENDOR_VIEW, VENDOR_WRITE } from "@/lib/rbac";
import { fmtDate } from "@/lib/format";
import VendorStatusActions from "@/components/VendorStatusActions";
import VendorInfoCards, { type VendorFields } from "@/components/VendorInfoCards";
import DocumentRequestButton from "@/components/DocumentRequestButton";
import SectionNav from "@/components/SectionNav";
import {
  Avatar,
  Card,
  CardHeader,
  CardBody,
  Chip,
  StatusChip,
  btn,
  cn,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import {
  FileText,
  Eye,
  Download,
  FileDown,
  FileSpreadsheet,
  BadgeCheck,
  AlertTriangle,
  Wrench,
  Package,
  History,
  ReceiptText,
  TrendingUp,
  MapPin,
  Phone,
  ArrowLeft,
} from "lucide-react";
import { DOC_LABELS } from "@/lib/doc-labels";

export const dynamic = "force-dynamic";

function fmtBytes(n?: number | null) {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function savedPct(original?: number | null, stored?: number | null) {
  if (!original || !stored) return "0%";
  return `${Math.round((1 - stored / original) * 100)}%`;
}

// Anchor chip in the snapshot strip — jumps to the section that explains it.
function SnapshotChip({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200 transition-colors",
        "hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-200"
      )}
    >
      {children}
    </a>
  );
}

// Sticky offsets: the breadcrumbed PageHeader is ~6.4rem tall (plus the mobile
// topbar), so the scroll-spy nav and section anchors must clear it.
const SECTION_ANCHOR = "scroll-mt-[calc(var(--h-topbar)+10rem)] md:scroll-mt-40";

export default async function VendorDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requirePageRole(VENDOR_VIEW);
  const canWrite = VENDOR_WRITE.includes(viewer.role);

  const { id } = await params;
  const v = await prisma.vendor.findUnique({
    where: { id },
    include: {
      services: { orderBy: { id: "asc" } },
      documents: { orderBy: { uploadedAt: "asc" } },
      invite: { select: { email: true } },
      products: { orderBy: { id: "asc" } },
      experiences: { orderBy: { id: "asc" } },
      purchaseOrders: { orderBy: { id: "asc" } },
      turnovers: { orderBy: { id: "asc" } },
    },
  });
  if (!v) notFound();

  const invitedEmail = v.invite?.email ?? null;
  const emailMismatch =
    !!invitedEmail && invitedEmail.toLowerCase() !== v.email.toLowerCase();

  const vendorFields: VendorFields = {
    companyName: v.companyName ?? "",
    contactPerson: v.contactPerson ?? "",
    mobileNumber: v.mobileNumber ?? "",
    email: v.email ?? "",
    address: v.address ?? "",
    state: v.state ?? "",
    country: v.country ?? "",
    pinCode: v.pinCode ?? "",
    website: v.website ?? "",
    dateOfIncorporation: v.dateOfIncorporation
      ? v.dateOfIncorporation.toISOString().slice(0, 10)
      : "",
    yearsOfService: v.yearsOfService ?? "",
    annualTurnover: v.annualTurnover ?? "",
    gstNo: v.gstNo ?? "",
    panNo: v.panNo ?? "",
    msmeNo: v.msmeNo ?? "",
    bankName: v.bankName ?? "",
    bankBranchAddress: v.bankBranchAddress ?? "",
    bankAccountNo: v.bankAccountNo ?? "",
    bankBranchCode: v.bankBranchCode ?? "",
    ifscCode: v.ifscCode ?? "",
    swiftCode: v.swiftCode ?? "",
    ibanCode: v.ibanCode ?? "",
  };

  const liveDocuments = v.documents.filter((d) => !d.purgedAt).length;
  const sections = [
    { id: "review", label: "Review" },
    { id: "company", label: "Company & KYC" },
    { id: "documents", label: `Documents (${v.documents.length})` },
    { id: "services", label: `Services (${v.services.length})` },
    { id: "experience", label: `Experience (${v.experiences.length})` },
    { id: "orders", label: `POs (${v.purchaseOrders.length})` },
    { id: "turnover", label: "Turnover" },
  ];

  return (
    <>
      <PageHeader
        title={v.companyName}
        subtitle={v.vendorCode ?? undefined}
        breadcrumbs={[
          { label: "SCM", href: "/scm" },
          { label: "Vendors", href: "/scm/vendors" },
          { label: v.companyName },
        ]}
      >
        <Link href="/scm/vendors" className={cn(btn("ghost", "sm"), "hidden sm:inline-flex")}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <a href={`/api/vendors/${v.id}/export`} className={btn("secondary", "sm")}>
          <FileSpreadsheet className="h-4 w-4" />
          Excel
        </a>
        <a href={`/vendors/${v.id}/print`} target="_blank" rel="noopener noreferrer" className={btn("primary", "sm")}>
          <FileDown className="h-4 w-4" />
          PDF
        </a>
      </PageHeader>

      {/* Identity band — data-adjacent, so no brand atmosphere here. */}
      <div className="border-b border-slate-200/70 bg-white px-6 py-5 sm:px-8">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={v.companyName} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display truncate text-base font-semibold text-slate-900">
                {v.companyName}
              </h2>
              <StatusChip status={v.status} />
              {v.vendorCode && (
                <span className="nums inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 font-mono text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/20">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {v.vendorCode}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-slate-500">
              {v.contactPerson && <span>{v.contactPerson}</span>}
              {v.contactPerson && <span className="text-slate-300">·</span>}
              <span className="truncate">{v.email}</span>
              {v.mobileNumber && (
                <Chip>
                  <Phone className="h-3 w-3 text-slate-400" aria-hidden="true" />
                  <span className="nums">{v.mobileNumber}</span>
                </Chip>
              )}
              {v.state && (
                <Chip>
                  <MapPin className="h-3 w-3 text-slate-400" aria-hidden="true" />
                  {v.state}
                </Chip>
              )}
              <Chip className="nums">Registered {fmtDate(v.createdAt)}</Chip>
            </div>
          </div>
        </div>
      </div>

      {/* Snapshot strip — each chip jumps to the section that explains it. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/70 bg-white px-6 py-3 sm:px-8">
        <SnapshotChip href="#documents">
          <FileText className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <span className="nums">{liveDocuments} of {v.documents.length} docs live</span>
        </SnapshotChip>
        <SnapshotChip href="#services">
          <Wrench className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <span className="nums">{v.services.length} services</span>
        </SnapshotChip>
        <SnapshotChip href="#experience">
          <History className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <span className="nums">{v.experiences.length} past works</span>
        </SnapshotChip>
        <SnapshotChip href="#orders">
          <ReceiptText className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <span className="nums">{v.purchaseOrders.length} POs</span>
        </SnapshotChip>
        <SnapshotChip href="#turnover">
          <TrendingUp className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <span className="nums">{v.turnovers.length} FY turnover</span>
        </SnapshotChip>
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        <SectionNav
          sections={sections}
          className="top-[calc(var(--h-topbar)+6.5rem)] md:top-[6.5rem]"
        />

        {/* ── Review & status ─────────────────────────────────────────── */}
        <section id="review" className={SECTION_ANCHOR}>
          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <BadgeCheck className="h-[18px] w-[18px] text-brand" />
                  Review &amp; Status
                </span>
              }
              subtitle="Move this vendor through review. Approving assigns a permanent GNE vendor code."
            />
            <CardBody>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <dl className="flex flex-wrap gap-x-10 gap-y-3">
                  <div>
                    <dt className="text-xs text-slate-400">Current status</dt>
                    <dd className="mt-1">
                      <StatusChip status={v.status} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Vendor code</dt>
                    <dd className="nums mt-1 font-mono text-sm font-semibold text-slate-900">
                      {v.vendorCode || (
                        <span className="font-sans font-normal text-slate-400">Assigned on approval</span>
                      )}
                    </dd>
                  </div>
                  {invitedEmail && (
                    <div>
                      <dt className="text-xs text-slate-400">Invited address</dt>
                      <dd className="mt-1 text-sm font-medium text-slate-700">{invitedEmail}</dd>
                    </div>
                  )}
                </dl>
                <div className="lg:pl-6">
                  {canWrite && <VendorStatusActions vendorId={v.id} status={v.status} vendorCode={v.vendorCode} />}
                </div>
              </div>
              {emailMismatch && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    The registered email (<b>{v.email}</b>) differs from the invited address (
                    <b>{invitedEmail}</b>). Confirm the vendor&apos;s identity before approving.
                  </span>
                </div>
              )}
            </CardBody>
          </Card>
        </section>

        {/* ── Company & KYC + Documents ───────────────────────────────── */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <section id="company" className={cn(SECTION_ANCHOR, "min-w-0")}>
            <VendorInfoCards vendorId={v.id} initial={vendorFields} canEdit={canWrite} />
          </section>

          <section id="documents" className={cn(SECTION_ANCHOR, "min-w-0")}>
            <Card>
              <CardHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    <FileText className="h-[18px] w-[18px] text-brand" />
                    Documents
                  </span>
                }
                subtitle={
                  v.documents.length > 0
                    ? `${liveDocuments} of ${v.documents.length} still stored`
                    : undefined
                }
              />
              <CardBody>
                {v.documents.length === 0 ? (
                  <EmptyState
                    icon={<FileText className="h-6 w-6" />}
                    title="No documents uploaded"
                    description="KYC files the vendor uploads during registration appear here."
                  />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {v.documents.map((d) => (
                      <li key={d.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <span
                              className={cn(
                                "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                                d.purgedAt ? "bg-slate-100 text-slate-400" : "bg-brand-50 text-brand-700"
                              )}
                            >
                              <FileText className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-900">
                                {DOC_LABELS[d.docType] ?? d.docType}
                              </div>
                              <div className="mt-0.5 truncate text-xs text-slate-400">
                                {d.originalName}
                              </div>
                            </div>
                          </div>
                          {d.purgedAt ? (
                            <span className="text-xs italic text-slate-400">
                              deleted {fmtDate(d.purgedAt)} (after download)
                            </span>
                          ) : (
                            <div className="flex shrink-0 items-center gap-2">
                              {canWrite && <DocumentRequestButton vendorId={v.id} documentId={d.id} />}
                              <a
                                href={`/api/documents/${d.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={btn("secondary", "sm")}
                              >
                                <Eye className="h-4 w-4" />
                                View
                              </a>
                              <a
                                href={`/api/documents/${d.id}?download=1`}
                                className={btn("primary", "sm")}
                              >
                                <Download className="h-4 w-4" />
                                Download
                              </a>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-12 text-xs text-slate-400">
                          <span className="nums">{fmtBytes(d.originalSize)}</span>
                          {d.compressed && d.originalSize ? (
                            <span className="nums font-medium text-emerald-600">
                              compressed −{savedPct(d.originalSize, d.storedSize)}
                            </span>
                          ) : null}
                          {!d.purgedAt && d.downloadCount > 0 && d.purgeAfter && (
                            <span className="nums">
                              downloaded {d.downloadCount}× · auto-deletes {fmtDate(d.purgeAfter)}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </section>
        </div>

        {/* ── Services & offerings ────────────────────────────────────── */}
        <section id="services" className={SECTION_ANCHOR}>
          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Wrench className="h-[18px] w-[18px] text-brand" />
                  Services &amp; Offerings
                </span>
              }
              subtitle="What this vendor supplies — service categories and product lines."
            />
            <CardBody className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Offers</span>
                {v.offersService && <Chip className="bg-brand-50 text-brand-700">Service</Chip>}
                {v.offersProduct && <Chip className="bg-brand-50 text-brand-700">Product</Chip>}
                {v.offersProduct && v.oemOrDealer && <Chip>{v.oemOrDealer}</Chip>}
                {!v.offersService && !v.offersProduct && (
                  <span className="text-sm text-slate-400">Not specified</span>
                )}
              </div>

              {v.services.length === 0 ? (
                <p className="text-sm text-slate-400">No service categories selected.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {v.services.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-2 py-2.5 first:pt-0 last:pb-0">
                      <Chip>{s.category}</Chip>
                      {s.item && <span className="text-sm text-slate-700">{s.item}</span>}
                    </li>
                  ))}
                </ul>
              )}

              {v.products.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Products</div>
                  <ul className="divide-y divide-slate-100">
                    {v.products.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-2 py-2.5 first:pt-0 last:pb-0 text-sm">
                        <Package className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="font-medium text-slate-800">{p.name}</span>
                        {p.brand && <span className="text-slate-500">{p.brand}</span>}
                        {p.model && <span className="nums font-mono text-xs text-slate-400">{p.model}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardBody>
          </Card>
        </section>

        {/* ── Experience + Purchase orders ────────────────────────────── */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <section id="experience" className={cn(SECTION_ANCHOR, "min-w-0")}>
            <Card>
              <CardHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    <History className="h-[18px] w-[18px] text-brand" />
                    Experience
                  </span>
                }
                subtitle="Client projects the vendor has delivered."
              />
              <CardBody>
                {v.experiences.length === 0 ? (
                  <p className="text-sm text-slate-400">None provided.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {v.experiences.map((e) => (
                      <li key={e.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <Chip className="nums">{e.financialYear}</Chip>
                          <span className="font-medium text-slate-800">{e.clientProject}</span>
                        </div>
                        {(e.scope || e.value) && (
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                            {e.scope && <span>{e.scope}</span>}
                            {e.value && <span className="nums font-medium text-slate-700">{e.value}</span>}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </section>

          <section id="orders" className={cn(SECTION_ANCHOR, "min-w-0")}>
            <Card>
              <CardHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    <ReceiptText className="h-[18px] w-[18px] text-brand" />
                    Purchase Orders
                  </span>
                }
                subtitle="Reference POs submitted with the registration."
              />
              <CardBody>
                {v.purchaseOrders.length === 0 ? (
                  <p className="text-sm text-slate-400">None provided.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {v.purchaseOrders.map((po) => (
                      <li key={po.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          {po.poNumber && <Chip className="nums font-mono">{po.poNumber}</Chip>}
                          {po.client && <span className="font-medium text-slate-800">{po.client}</span>}
                          {!po.poNumber && !po.client && !po.value && !po.poDate && (
                            <span className="text-slate-300">—</span>
                          )}
                        </div>
                        {(po.value || po.poDate) && (
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                            {po.value && <span className="nums font-medium text-slate-700">{po.value}</span>}
                            {po.poDate && <span className="nums">{fmtDate(po.poDate)}</span>}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </section>
        </div>

        {/* ── Turnover ────────────────────────────────────────────────── */}
        <section id="turnover" className={SECTION_ANCHOR}>
          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <TrendingUp className="h-[18px] w-[18px] text-brand" />
                  Annual Turnover
                </span>
              }
              subtitle="Financial-year turnover figures declared by the vendor."
            />
            <CardBody>
              {v.turnovers.length === 0 ? (
                <p className="text-sm text-slate-400">None provided.</p>
              ) : (
                <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                  {v.turnovers.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2.5"
                    >
                      <dt className="nums text-[13px] font-medium text-slate-500">{t.financialYear}</dt>
                      <dd className="nums text-sm font-semibold text-slate-800">{t.amount}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardBody>
          </Card>
        </section>
      </div>
    </>
  );
}
