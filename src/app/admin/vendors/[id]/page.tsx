import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import Badge from "@/components/Badge";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-3 py-1.5 border-b border-slate-50 last:border-0">
      <div className="w-48 shrink-0 text-sm text-slate-500">{label}</div>
      <div className="text-sm text-slate-900">{value || <span className="text-slate-300">—</span>}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-base font-semibold text-slate-900 mb-3">{title}</h2>
      {children}
    </section>
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
      <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8">
        <Link href="/admin/vendors" className="text-sm text-brand hover:underline">
          ← Vendors
        </Link>
      </header>
      <div className="p-8 max-w-4xl space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-slate-900">{v.companyName}</h1>
          <Badge value={v.status} />
          <span className="text-xs text-slate-400 ml-auto">
            Registered {fmtDate(v.createdAt)}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card title="Company Information">
            <Row label="Contact Person" value={v.contactPerson} />
            <Row label="Mobile" value={v.mobileNumber} />
            <Row label="Email" value={v.email} />
            <Row label="Address" value={v.address} />
            <Row label="State" value={v.state} />
            <Row label="Website" value={v.website} />
            <Row label="Date of Incorporation" value={fmtDate(v.dateOfIncorporation)} />
            <Row label="Years of Service" value={v.yearsOfService} />
            <Row label="Annual Turnover" value={v.annualTurnover} />
          </Card>

          <Card title="Statutory & Tax">
            <Row label="GST No" value={v.gstNo} />
            <Row label="PAN No" value={v.panNo} />
            <Row label="Excise No" value={v.exciseNo} />
            <Row label="TIN No" value={v.tinNo} />
            <Row label="VAT / LST No" value={v.vatLstNo} />
            <Row label="CST No" value={v.cstNo} />
            <Row label="Service Tax No" value={v.serviceTaxNo} />
            <Row label="MSME No" value={v.msmeNo} />
          </Card>

          <Card title="Bank Details">
            <Row label="Bank Name" value={v.bankName} />
            <Row label="Branch Address" value={v.bankBranchAddress} />
            <Row label="Account No" value={v.bankAccountNo} />
            <Row label="Branch Code" value={v.bankBranchCode} />
            <Row label="IFSC Code" value={v.ifscCode} />
            <Row label="SWIFT Code" value={v.swiftCode} />
            <Row label="IBAN Code" value={v.ibanCode} />
          </Card>

          <Card title="Documents">
            {v.documents.length === 0 ? (
              <p className="text-sm text-slate-400">No documents uploaded.</p>
            ) : (
              <ul className="space-y-3">
                {v.documents.map((d) => (
                  <li key={d.id} className="text-sm border-b border-slate-50 last:border-0 pb-3 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">{DOC_LABELS[d.docType] ?? d.docType}</span>
                      {d.purgedAt ? (
                        <span className="text-xs text-slate-400 italic">
                          deleted {fmtDate(d.purgedAt)} (after download)
                        </span>
                      ) : (
                        <a
                          href={`/api/documents/${d.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand hover:underline truncate max-w-[55%]"
                        >
                          {d.originalName} ↓
                        </a>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-400 flex flex-wrap gap-x-3">
                      <span>{fmtBytes(d.originalSize)}</span>
                      {d.compressed && d.originalSize ? (
                        <span className="text-emerald-600">
                          compressed −{savedPct(d.originalSize, d.storedSize)}
                        </span>
                      ) : null}
                      {d.downloadCount > 0 && (
                        <span>
                          downloaded {d.downloadCount}× · auto-deletes {fmtDate(d.purgeAfter)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title={`Past Projects (${v.projects.length})`}>
          {v.projects.length === 0 ? (
            <p className="text-sm text-slate-400">No projects listed.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Client</th>
                    <th className="py-2 pr-3">Capacity</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">EPC/I&C/BOS</th>
                    <th className="py-2 pr-3">Location</th>
                    <th className="py-2 pr-3">Year</th>
                    <th className="py-2 pr-3">Scope</th>
                    <th className="py-2 pr-3">% Done</th>
                    <th className="py-2 pr-3">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {v.projects.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50">
                      <td className="py-2 pr-3 text-slate-400">{p.serialNo}</td>
                      <td className="py-2 pr-3">{p.clientName}</td>
                      <td className="py-2 pr-3">{p.capacity}</td>
                      <td className="py-2 pr-3">{p.projectType}</td>
                      <td className="py-2 pr-3">{p.contractType}</td>
                      <td className="py-2 pr-3">{p.location}</td>
                      <td className="py-2 pr-3">{p.yearOfCompletion}</td>
                      <td className="py-2 pr-3">{p.scopeOfWork}</td>
                      <td className="py-2 pr-3">{p.percentCompleted}</td>
                      <td className="py-2 pr-3">{p.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
