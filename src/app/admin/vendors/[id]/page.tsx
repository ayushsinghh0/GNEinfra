import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import Badge from "@/components/Badge";
import VendorStatusActions from "@/components/VendorStatusActions";
import VendorInfoCards, { type VendorFields } from "@/components/VendorInfoCards";
import DocumentRequestButton from "@/components/DocumentRequestButton";
import {
  Card,
  CardHeader,
  CardBody,
  Chip,
  btn,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import {
  ArrowLeft,
  FileText,
  Eye,
  Download,
  FileDown,
  FileSpreadsheet,
  CalendarDays,
  BadgeCheck,
  AlertTriangle,
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

export default async function VendorDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdminAuthed())) return null;

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

  return (
    <>
      <PageHeader title="Vendor Details">
        <Link href="/admin/vendors" className={btn("secondary", "sm")}>
          <ArrowLeft className="h-4 w-4" />
          Vendors
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

      <div className="p-8 space-y-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-slate-900">
            {v.companyName}
          </h1>
          <Badge value={v.status} />
          {v.vendorCode && (
            <span className="nums inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/20">
              <BadgeCheck className="h-3.5 w-3.5" />
              {v.vendorCode}
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-slate-400">
            <CalendarDays className="h-4 w-4" />
            Registered <span className="nums">{fmtDate(v.createdAt)}</span>
          </span>
        </div>

        {/* Review & status */}
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
                    <Badge value={v.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Vendor code</dt>
                  <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                    {v.vendorCode || (
                      <span className="font-normal text-slate-400">Assigned on approval</span>
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
                <VendorStatusActions vendorId={v.id} status={v.status} vendorCode={v.vendorCode} />
              </div>
            </div>
            {emailMismatch && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  The registered email (<b>{v.email}</b>) differs from the invited address (
                  <b>{invitedEmail}</b>). Confirm the vendor&apos;s identity before approving.
                </span>
              </div>
            )}
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <VendorInfoCards vendorId={v.id} initial={vendorFields} />

          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <FileText className="h-[18px] w-[18px] text-brand" />
                  Documents
                </span>
              }
            />
            <CardBody>
              {v.documents.length === 0 ? (
                <p className="text-sm text-slate-400">No documents uploaded.</p>
              ) : (
                <ul className="space-y-3">
                  {v.documents.map((d) => (
                    <li
                      key={d.id}
                      className="rounded-xl border border-slate-200 p-4 transition-colors hover:border-slate-300"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900">
                            {DOC_LABELS[d.docType] ?? d.docType}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-slate-400">
                            {d.originalName}
                          </div>
                        </div>
                        {d.purgedAt ? (
                          <span className="text-xs italic text-slate-400">
                            deleted {fmtDate(d.purgedAt)} (after download)
                          </span>
                        ) : (
                          <div className="flex shrink-0 items-center gap-2">
                            <DocumentRequestButton vendorId={v.id} documentId={d.id} />
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
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                        <span>{fmtBytes(d.originalSize)}</span>
                        {d.compressed && d.originalSize ? (
                          <span className="font-medium text-emerald-600">
                            compressed −{savedPct(d.originalSize, d.storedSize)}
                          </span>
                        ) : null}
                        {!d.purgedAt && d.downloadCount > 0 && d.purgeAfter && (
                          <span>
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
        </div>

        <Card>
          <CardHeader title={`Services (${v.services.length})`} />
          <CardBody>
            {v.services.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-6 w-6" />}
                title="No services listed"
                description="This vendor has not selected any service categories yet."
              />
            ) : (
              <div className="space-y-3">
                {v.services.map((s) => (
                  <div key={s.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip>{s.category}</Chip>
                      {s.item && <span className="text-sm text-slate-700">{s.item}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* ── Offerings ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader title="Offerings" />
          <CardBody>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {v.offersService && <Chip>Service</Chip>}
                {v.offersProduct && <Chip>Product</Chip>}
                {v.offersProduct && v.oemOrDealer && <Chip>{v.oemOrDealer}</Chip>}
                {!v.offersService && !v.offersProduct && (
                  <span className="text-sm text-slate-400">—</span>
                )}
              </div>
              {v.products.length > 0 && (
                <div className="space-y-2">
                  {v.products.map((p) => (
                    <div key={p.id} className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                      {p.name}
                      {p.brand ? ` — ${p.brand}` : ""}
                      {p.model ? ` — ${p.model}` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* ── Experience ────────────────────────────────────────────────── */}
        <Card>
          <CardHeader title={`Experience (${v.experiences.length})`} />
          <CardBody>
            {v.experiences.length === 0 ? (
              <p className="text-sm text-slate-400">None provided.</p>
            ) : (
              <div className="space-y-3">
                {v.experiences.map((e) => (
                  <div key={e.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Chip>{e.financialYear}</Chip>
                      <span className="font-medium text-slate-800">{e.clientProject}</span>
                    </div>
                    {(e.scope || e.value) && (
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        {e.scope && <span>{e.scope}</span>}
                        {e.value && <span className="nums font-medium text-slate-700">{e.value}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* ── Purchase Orders ───────────────────────────────────────────── */}
        <Card>
          <CardHeader title={`Purchase Orders (${v.purchaseOrders.length})`} />
          <CardBody>
            {v.purchaseOrders.length === 0 ? (
              <p className="text-sm text-slate-400">None provided.</p>
            ) : (
              <div className="space-y-3">
                {v.purchaseOrders.map((po) => (
                  <div key={po.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {po.poNumber && <Chip>{po.poNumber}</Chip>}
                      {po.client && <span className="font-medium text-slate-800">{po.client}</span>}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {po.value && <span className="nums font-medium text-slate-700">{po.value}</span>}
                      {po.poDate && <span className="nums">{fmtDate(po.poDate)}</span>}
                      {!po.poNumber && !po.client && !po.value && !po.poDate && (
                        <span className="text-slate-300">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* ── Turnover ──────────────────────────────────────────────────── */}
        <Card>
          <CardHeader title={`Turnover (${v.turnovers.length})`} />
          <CardBody>
            {v.turnovers.length === 0 ? (
              <p className="text-sm text-slate-400">None provided.</p>
            ) : (
              <div className="space-y-3">
                {v.turnovers.map((t) => (
                  <div key={t.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <Chip>{t.financialYear}</Chip>
                      <span className="nums font-semibold text-slate-800">{t.amount}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
