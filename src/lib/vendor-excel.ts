import ExcelJS from "exceljs";
import type { Vendor, VendorService, VendorDocument } from "@prisma/client";
import { DOC_LABELS } from "@/lib/doc-labels";

type VendorWithRelations = Vendor & {
  services: VendorService[];
  documents: VendorDocument[];
};

// Build an .xlsx of a single vendor's record — the same content as the print/PDF
// view (company, statutory, bank, services, documents), as a downloadable sheet.
export async function buildVendorWorkbook(v: VendorWithRelations): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GNE ERP";

  const ws = wb.addWorksheet("Vendor Record");
  ws.columns = [{ width: 30 }, { width: 64 }];

  const fmtDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

  const titleRow = ws.addRow([v.companyName || "Vendor"]);
  titleRow.font = { bold: true, size: 16 };
  ws.mergeCells(`A${titleRow.number}:B${titleRow.number}`);

  const metaRow = ws.addRow([
    `Status: ${v.status}${v.vendorCode ? `   ·   Code: ${v.vendorCode}` : ""}   ·   Registered: ${fmtDate(
      v.createdAt
    )}`,
  ]);
  metaRow.font = { size: 10, color: { argb: "FF6B7280" } };
  ws.mergeCells(`A${metaRow.number}:B${metaRow.number}`);
  ws.addRow([]);

  const section = (label: string) => {
    const r = ws.addRow([label]);
    r.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    ws.mergeCells(`A${r.number}:B${r.number}`);
  };
  const kv = (label: string, value: string | null | undefined) => {
    const r = ws.addRow([label, value && value.trim() ? value : "—"]);
    r.getCell(1).font = { color: { argb: "FF6B7280" } };
    r.getCell(2).alignment = { wrapText: true, vertical: "top" };
  };

  section("Company Information");
  kv("Contact Person", v.contactPerson);
  kv("Mobile Number", v.mobileNumber);
  kv("Email", v.email);
  kv("Address", v.address);
  kv("State", v.state);
  kv("Country", v.country);
  kv("PIN Code", v.pinCode);
  kv("Website", v.website);
  kv("Date of Incorporation", fmtDate(v.dateOfIncorporation));
  kv("Years of Service", v.yearsOfService);
  kv("Annual Turnover", v.annualTurnover);
  ws.addRow([]);

  section("Statutory & Tax");
  kv("GST No", v.gstNo);
  kv("PAN No", v.panNo);
  kv("Excise No", v.exciseNo);
  kv("TIN No", v.tinNo);
  kv("VAT / LST No", v.vatLstNo);
  kv("CST No", v.cstNo);
  kv("Service Tax No", v.serviceTaxNo);
  kv("MSME No", v.msmeNo);
  ws.addRow([]);

  section("Bank Details");
  kv("Bank Name", v.bankName);
  kv("Branch Address", v.bankBranchAddress);
  kv("Account No", v.bankAccountNo);
  kv("Branch Code", v.bankBranchCode);
  kv("IFSC Code", v.ifscCode);
  kv("SWIFT Code", v.swiftCode);
  kv("IBAN Code", v.ibanCode);
  ws.addRow([]);

  section(`Services (${v.services.length})`);
  const sHead = ws.addRow(["Service Category", "Item / Details"]);
  sHead.font = { bold: true };
  if (v.services.length === 0) {
    ws.addRow(["—", ""]);
  } else {
    for (const s of v.services) ws.addRow([s.category, s.item?.trim() || "—"]);
  }
  ws.addRow([]);

  section(`Documents (${v.documents.length})`);
  const dHead = ws.addRow(["Document", "File / Status"]);
  dHead.font = { bold: true };
  if (v.documents.length === 0) {
    ws.addRow(["—", ""]);
  } else {
    for (const d of v.documents) {
      ws.addRow([
        DOC_LABELS[d.docType] ?? d.docType,
        d.purgedAt ? "deleted after retention window" : d.originalName,
      ]);
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
