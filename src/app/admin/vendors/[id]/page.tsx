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
  CalendarDays,
  BadgeCheck,
  AlertTriangle,
} from "lucide-react";
import { DOC_LABELS } from "@/lib/doc-labels";

export const dynamic = "force-dynamic";

function PRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-slate-700">{value || <span className="text-slate-300">—</span>}</dd>
    </div>
  );
}

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
      projects: { orderBy: { serialNo: "asc" } },
      documents: { orderBy: { uploadedAt: "asc" } },
      invite: { select: { email: true } },
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
    website: v.website ?? "",
    dateOfIncorporation: v.dateOfIncorporation
      ? v.dateOfIncorporation.toISOString().slice(0, 10)
      : "",
    yearsOfService: v.yearsOfService ?? "",
    annualTurnover: v.annualTurnover ?? "",
    gstNo: v.gstNo ?? "",
    panNo: v.panNo ?? "",
    exciseNo: v.exciseNo ?? "",
    tinNo: v.tinNo ?? "",
    vatLstNo: v.vatLstNo ?? "",
    cstNo: v.cstNo ?? "",
    serviceTaxNo: v.serviceTaxNo ?? "",
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
        <a href={`/vendors/${v.id}/print`} target="_blank" rel="noopener noreferrer" className={btn("primary", "sm")}>
          <FileDown className="h-4 w-4" />
          Download PDF
        </a>
      </PageHeader>

      <div className="p-8 space-y-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {v.companyName}
          </h1>
          <Badge value={v.status} />
          {v.vendorCode && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/20">
              <BadgeCheck className="h-3.5 w-3.5" />
              {v.vendorCode}
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-slate-400">
            <CalendarDays className="h-4 w-4" />
            Registered {fmtDate(v.createdAt)}
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
          <CardHeader title={`Past Projects (${v.projects.length})`} />
          <CardBody>
            {v.projects.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-6 w-6" />}
                title="No projects listed"
                description="This vendor has not submitted any past projects yet."
              />
            ) : (
              <div className="space-y-3">
                {v.projects.map((p) => (
                  <div key={p.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-2.5 flex flex-wrap items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-md bg-slate-100 text-xs font-bold text-slate-600 tabular-nums">
                        {p.serialNo ?? "—"}
                      </span>
                      <span className="font-medium text-slate-900">
                        {p.clientName || "Project"}
                      </span>
                      {p.projectType && <Chip>{p.projectType}</Chip>}
                      {p.contractType && <Chip>{p.contractType}</Chip>}
                      {p.percentCompleted && <Chip>{p.percentCompleted}% done</Chip>}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
                      <PRow label="Capacity" value={p.capacity} />
                      <PRow label="Location" value={p.location} />
                      <PRow label="Year" value={p.yearOfCompletion} />
                      <PRow label="Scope" value={p.scopeOfWork} />
                      {p.remarks && (
                        <div className="col-span-full">
                          <PRow label="Remarks" value={p.remarks} />
                        </div>
                      )}
                    </dl>
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
