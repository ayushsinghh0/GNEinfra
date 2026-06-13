import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { fmtDate, fmtDateOnly } from "@/lib/format";
import Badge from "@/components/Badge";
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
  Building,
  ShieldCheck,
  Banknote,
  FileText,
  Eye,
  Download,
  FileDown,
  CalendarDays,
} from "lucide-react";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-4 py-2 border-b border-slate-100 last:border-0">
      <dt className="w-44 shrink-0 text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">
        {value || <span className="font-normal text-slate-300">—</span>}
      </dd>
    </div>
  );
}

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

const DOC_LABELS: Record<string, string> = {
  CANCELLED_CHEQUE: "Cancelled Cheque",
  GST_CERTIFICATE: "GST Certificate",
  PAN_CARD: "PAN Card",
  OTHER: "Other",
};

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
    },
  });
  if (!v) notFound();

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
          <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-slate-400">
            <CalendarDays className="h-4 w-4" />
            Registered {fmtDate(v.createdAt)}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Building className="h-[18px] w-[18px] text-brand" />
                  Company Information
                </span>
              }
            />
            <CardBody>
              <dl>
                <Row label="Contact Person" value={v.contactPerson} />
                <Row label="Mobile" value={v.mobileNumber} />
                <Row label="Email" value={v.email} />
                <Row label="Address" value={v.address} />
                <Row label="State" value={v.state} />
                <Row label="Website" value={v.website} />
                <Row label="Date of Incorporation" value={fmtDateOnly(v.dateOfIncorporation)} />
                <Row label="Years of Service" value={v.yearsOfService} />
                <Row label="Annual Turnover" value={v.annualTurnover} />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-[18px] w-[18px] text-brand" />
                  Statutory &amp; Tax
                </span>
              }
            />
            <CardBody>
              <dl>
                <Row label="GST No" value={v.gstNo} />
                <Row label="PAN No" value={v.panNo} />
                <Row label="Excise No" value={v.exciseNo} />
                <Row label="TIN No" value={v.tinNo} />
                <Row label="VAT / LST No" value={v.vatLstNo} />
                <Row label="CST No" value={v.cstNo} />
                <Row label="Service Tax No" value={v.serviceTaxNo} />
                <Row label="MSME No" value={v.msmeNo} />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Banknote className="h-[18px] w-[18px] text-brand" />
                  Bank Details
                </span>
              }
            />
            <CardBody>
              <dl>
                <Row label="Bank Name" value={v.bankName} />
                <Row label="Branch Address" value={v.bankBranchAddress} />
                <Row label="Account No" value={v.bankAccountNo} />
                <Row label="Branch Code" value={v.bankBranchCode} />
                <Row label="IFSC Code" value={v.ifscCode} />
                <Row label="SWIFT Code" value={v.swiftCode} />
                <Row label="IBAN Code" value={v.ibanCode} />
              </dl>
            </CardBody>
          </Card>

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
