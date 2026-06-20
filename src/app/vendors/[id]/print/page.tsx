import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { fmtDate, fmtDateOnly } from "@/lib/format";
import PrintBar from "@/components/PrintBar";

export const dynamic = "force-dynamic";

const DOC_LABELS: Record<string, string> = {
  CANCELLED_CHEQUE: "Cancelled Cheque",
  GST_CERTIFICATE: "GST Certificate",
  PAN_CARD: "PAN Card",
  OTHER: "Other",
};

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-3 border-b border-slate-200 py-1.5">
      <div className="w-44 shrink-0 text-[13px] text-slate-500">{label}</div>
      <div className="text-[13px] text-slate-900">{value || "—"}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="mb-2 border-b-2 border-slate-900 pb-1 text-[13px] font-bold uppercase tracking-wide text-slate-900">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function VendorPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Admin-only — this page lives outside the /admin layout so it prints clean.
  if (!(await isAdminAuthed())) notFound();

  const { id } = await params;
  const v = await prisma.vendor.findUnique({
    where: { id },
    include: {
      services: { orderBy: { id: "asc" } },
      documents: { orderBy: { uploadedAt: "asc" } },
    },
  });
  if (!v) notFound();

  return (
    <main className="min-h-screen bg-white">
      <PrintBar backHref={`/admin/vendors/${v.id}`} />

      <div className="mx-auto max-w-3xl px-10 py-8 print:px-0 print:py-0">
        {/* Letterhead */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white">
              GNE
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-slate-900">
                GNE — Vendor Record
              </div>
              <div className="text-xs text-slate-500">Solar EPC · Procurement</div>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>Status: <span className="font-semibold text-slate-900">{v.status.replace(/_/g, " ")}</span></div>
            {v.vendorCode && <div>Code: {v.vendorCode}</div>}
            <div>Registered: {fmtDate(v.createdAt)}</div>
            <div>Printed: {fmtDate(new Date())}</div>
          </div>
        </div>

        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
          {v.companyName}
        </h1>

        <Section title="Company Information">
          <Row label="Contact Person" value={v.contactPerson} />
          <Row label="Mobile Number" value={v.mobileNumber} />
          <Row label="Email Address" value={v.email} />
          <Row label="Address" value={v.address} />
          <Row label="State" value={v.state} />
          <Row label="Country" value={v.country} />
          <Row label="PIN Code" value={v.pinCode} />
          <Row label="Website" value={v.website} />
          <Row label="Date of Incorporation" value={fmtDateOnly(v.dateOfIncorporation)} />
          <Row label="Years of Service" value={v.yearsOfService} />
          <Row label="Annual Turnover" value={v.annualTurnover} />
        </Section>

        <Section title="Statutory & Tax Registration">
          <Row label="GST No" value={v.gstNo} />
          <Row label="PAN No" value={v.panNo} />
          <Row label="Excise No" value={v.exciseNo} />
          <Row label="TIN No" value={v.tinNo} />
          <Row label="VAT / LST No" value={v.vatLstNo} />
          <Row label="CST No" value={v.cstNo} />
          <Row label="Service Tax No" value={v.serviceTaxNo} />
          <Row label="MSME No" value={v.msmeNo} />
        </Section>

        <Section title="Bank Details">
          <Row label="Bank Name" value={v.bankName} />
          <Row label="Branch Address" value={v.bankBranchAddress} />
          <Row label="Account No" value={v.bankAccountNo} />
          <Row label="Branch Code" value={v.bankBranchCode} />
          <Row label="IFSC Code" value={v.ifscCode} />
          <Row label="SWIFT Code" value={v.swiftCode} />
          <Row label="IBAN Code" value={v.ibanCode} />
        </Section>

        <Section title={`Services (${v.services.length})`}>
          {v.services.length === 0 ? (
            <p className="text-[13px] text-slate-500">None listed.</p>
          ) : (
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-slate-300 text-left text-slate-500">
                  <th className="py-1 pr-2 font-semibold">#</th>
                  <th className="py-1 pr-2 font-semibold">Service Category</th>
                  <th className="py-1 pr-2 font-semibold">Item / Details</th>
                </tr>
              </thead>
              <tbody>
                {v.services.map((s, i) => (
                  <tr key={s.id} className="border-b border-slate-100 align-top text-slate-800">
                    <td className="py-1 pr-2">{i + 1}</td>
                    <td className="py-1 pr-2">{s.category}</td>
                    <td className="py-1 pr-2">{s.item || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title={`Documents (${v.documents.length})`}>
          {v.documents.length === 0 ? (
            <p className="text-[13px] text-slate-500">None uploaded.</p>
          ) : (
            <ul className="text-[13px] text-slate-800">
              {v.documents.map((d) => (
                <li key={d.id} className="flex justify-between border-b border-slate-100 py-1">
                  <span>{DOC_LABELS[d.docType] ?? d.docType} — {d.originalName}</span>
                  <span className="text-slate-400">
                    {d.purgedAt ? "deleted after download" : "on file"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <p className="mt-10 text-center text-[11px] text-slate-400">
          Generated from the GNE ERP vendor portal · {fmtDate(new Date())}
        </p>
      </div>
    </main>
  );
}
