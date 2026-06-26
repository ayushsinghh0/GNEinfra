import ExcelJS from "exceljs";
import type {
  Vendor,
  VendorService,
  VendorDocument,
  VendorProduct,
  VendorExperience,
  VendorPurchaseOrder,
  VendorTurnover,
} from "@prisma/client";
import { DOC_LABELS } from "@/lib/doc-labels";

type VendorWithRelations = Vendor & {
  services: VendorService[];
  documents: VendorDocument[];
  products: VendorProduct[];
  experiences: VendorExperience[];
  purchaseOrders: VendorPurchaseOrder[];
  turnovers: VendorTurnover[];
};

// Build a multi-sheet .xlsx of a single vendor's record.
// Sheet 1 "Overview": key-value (Company, Statutory, Bank).
// Sheets 2-5: table sheets for Services & Products, Experience, Purchase Orders, Turnover.
// Sheet 6 "Documents": uploaded KYC file list.
export async function buildVendorWorkbook(v: VendorWithRelations): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GNE ERP";

  // ── Sheet 1: Overview (key-value layout) ──────────────────────────────────
  const ws = wb.addWorksheet("Overview");
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

  // Build a readable category string from the boolean flags
  const categoryParts: string[] = [];
  if (v.offersService) categoryParts.push("Service");
  if (v.offersProduct) categoryParts.push("Product");
  const categoryStr = categoryParts.length > 0 ? categoryParts.join(", ") : "—";

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
  kv("Category", categoryStr);
  kv("OEM / Dealer", v.oemOrDealer);
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

  // ── Table-sheet helper (sheets 2-6) ──────────────────────────────────────
  const tableSheet = (
    title: string,
    headers: string[],
    rows: (string | null | undefined)[][]
  ) => {
    const sheet = wb.addWorksheet(title);
    sheet.columns = headers.map(() => ({ width: 28 }));
    const head = sheet.addRow(headers);
    head.font = { bold: true };
    for (const r of rows)
      sheet.addRow(r.map((c) => (c && String(c).trim() ? String(c) : "—")));
  };

  // Sheet 2: Services & Products
  tableSheet(
    "Services & Products",
    ["Type", "Category / Activity", "Brand / Item", "Model"],
    [
      ...v.services.map((s): (string | null | undefined)[] => [
        "Service",
        s.category,
        s.item,
        "",
      ]),
      ...v.products.map((p): (string | null | undefined)[] => [
        "Product",
        p.name,
        p.brand,
        p.model,
      ]),
    ]
  );

  // Sheet 3: Experience
  tableSheet(
    "Experience",
    ["Financial Year", "Client / Project", "Scope", "Value"],
    v.experiences.map((e): (string | null | undefined)[] => [
      e.financialYear,
      e.clientProject,
      e.scope,
      e.value,
    ])
  );

  // Sheet 4: Purchase Orders
  tableSheet(
    "Purchase Orders",
    ["PO Number", "Client", "Value", "Date"],
    v.purchaseOrders.map((p): (string | null | undefined)[] => [
      p.poNumber,
      p.client,
      p.value,
      p.poDate ? p.poDate.toISOString().slice(0, 10) : "",
    ])
  );

  // Sheet 5: Turnover
  tableSheet(
    "Turnover",
    ["Financial Year", "Amount"],
    v.turnovers.map((t): (string | null | undefined)[] => [t.financialYear, t.amount])
  );

  // Sheet 6: Documents
  tableSheet(
    "Documents",
    ["Document", "File / Status"],
    v.documents.map((d): (string | null | undefined)[] => [
      DOC_LABELS[d.docType] ?? d.docType,
      d.purgedAt ? "deleted after retention window" : d.originalName,
    ])
  );

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
