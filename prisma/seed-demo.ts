/**
 * Demo data seeder — creates one login per role + a rich HR/vendor dataset.
 * Idempotent (upserts). Run against a dev/test DB only:
 *   DATABASE_URL=postgresql://.../gne_e2e npx tsx prisma/seed-demo.ts
 *
 * All demo logins share the password below and have mustChangePassword=false,
 * so you can sign in directly. NEVER run against production.
 */
import { PrismaClient, type Role, type AttendanceStatus } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { BD_CLIENTS } from "./bd-clients";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "gnedemo123";

const ROLE_USERS: { name: string; email: string; role: Role }[] = [
  { name: "Sahil Superadmin", email: "superadmin@gne.test", role: "SUPERADMIN" },
  { name: "Anita Admin", email: "admin@gne.test", role: "ADMIN" },
  { name: "Manish Manager", email: "manager@gne.test", role: "MANAGER" },
  { name: "Bhavna (BD)", email: "bd@gne.test", role: "BD" },
  { name: "Suresh (SCM)", email: "scm@gne.test", role: "SCM" },
  { name: "Pooja (Project)", email: "project@gne.test", role: "PROJECT" },
  { name: "Farhan (Finance)", email: "finance@gne.test", role: "FINANCE" },
  { name: "Harini (HR)", email: "hr@gne.test", role: "HR" },
];

const D = (s: string) => new Date(s + "T00:00:00.000Z");

type Emp = {
  empId: string; name: string; designation: string; empCategory: string;
  location: string; mailId: string; doj: string; gross: number; left?: string;
};
const EMPLOYEES: Emp[] = [
  { empId: "GNE-E001", name: "Asha Rao", designation: "Solar Engineer", empCategory: "On-Roll", location: "Delhi", mailId: "asha@gne.test", doj: "2023-02-15", gross: 65000 },
  { empId: "GNE-E002", name: "Rahul Verma", designation: "Senior Engineer", empCategory: "On-Roll", location: "Mumbai", mailId: "rahul@gne.test", doj: "2021-03-01", gross: 90000 },
  { empId: "GNE-E003", name: "Priya Singh", designation: "Project Manager", empCategory: "On-Roll", location: "Delhi", mailId: "priya@gne.test", doj: "2022-07-10", gross: 120000 },
  { empId: "GNE-E004", name: "Vikram Patel", designation: "Site Technician", empCategory: "Contract", location: "Bangalore", mailId: "vikram@gne.test", doj: "2025-11-01", gross: 35000 },
  { empId: "GNE-E005", name: "Neha Gupta", designation: "Accountant", empCategory: "On-Roll", location: "Mumbai", mailId: "neha@gne.test", doj: "2020-06-15", gross: 70000 },
  { empId: "GNE-E006", name: "Arjun Reddy", designation: "Field Engineer", empCategory: "Contract", location: "Bangalore", mailId: "arjun@gne.test", doj: "2024-09-20", gross: 42000, left: "2026-06-10" },
];

// last 6 months (2026-01 .. 2026-06)
const MONTHS = [1, 2, 3, 4, 5, 6];

function payrollFor(gross: number, monthIdx: number) {
  const g = Math.round(gross * (0.95 + monthIdx * 0.012)); // gentle upward trend
  const basic = Math.round(g * 0.5);
  const hra = Math.round(g * 0.2);
  const cca = Math.round(g * 0.05);
  const conveyance = 1600;
  const medicalReimb = 1250;
  const pla = Math.round(g * 0.05);
  const personalPay = g - basic - hra - cca - conveyance - medicalReimb - pla;
  const totalEarnings = basic + hra + cca + personalPay + conveyance + pla + medicalReimb;
  const epf = Math.round(basic * 0.12);
  const tds = Math.round(g * 0.05);
  const esi = g < 21000 ? Math.round(g * 0.0075) : 0;
  const loanAdv = 0;
  const totalDeductions = tds + loanAdv + epf + esi;
  return { basic, hra, cca, personalPay, conveyance, pla, medicalReimb, totalEarnings, tds, loanAdv, epf, esi, totalDeductions, payableAmount: totalEarnings - totalDeductions };
}

function attendanceStatus(empIdx: number, day: number): AttendanceStatus | null {
  const date = new Date(Date.UTC(2026, 5, day)); // June 2026
  const dow = date.getUTCDay();
  if (dow === 0 || dow === 6) return "WEEK_OFF";
  if (day === ((empIdx * 2) % 18) + 3) return "SICK";
  if (day === ((empIdx * 3) % 18) + 4) return "LEAVE";
  if (day === ((empIdx * 5) % 18) + 6) return "HALF_DAY";
  if (day === ((empIdx * 7) % 18) + 8) return "ABSENT";
  return "PRESENT";
}

async function main() {
  console.log("Seeding demo logins + data into", process.env.DATABASE_URL?.split("@")[1] ?? "(db)");
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // 1) one login per role
  for (const u of ROLE_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, passwordHash, mustChangePassword: false, isActive: true },
      create: { name: u.name, email: u.email, role: u.role, passwordHash, mustChangePassword: false, isActive: true },
    });
  }
  console.log(`  ✓ ${ROLE_USERS.length} role logins (password: ${DEMO_PASSWORD})`);

  // 2) employees
  const empIds: Record<string, string> = {};
  for (const e of EMPLOYEES) {
    const rec = await prisma.employee.upsert({
      where: { empId: e.empId },
      update: {},
      create: {
        empId: e.empId, name: e.name, designation: e.designation, empCategory: e.empCategory,
        location: e.location, mailId: e.mailId, dateOfJoining: D(e.doj),
        leavingDate: e.left ? D(e.left) : null, status: e.left ? "INACTIVE" : "ACTIVE",
        emergencyNumber: "9876543210", bloodGroup: "O+", casualLeaveQuota: 12, sickLeaveQuota: 12,
        bankAccountNo: "5012" + e.empId.replace(/\D/g, "").padStart(6, "0"),
        panNo: "ABCDE" + e.empId.replace(/\D/g, "").padStart(4, "0").slice(-4) + "F",
        uan: "100" + e.empId.replace(/\D/g, "").padStart(9, "0").slice(-9),
        totalCtc: e.gross * 12, salary: e.gross, lta: Math.round(e.gross * 0.5),
        specialAllowance: Math.round(e.gross * 0.1), conveyance: 1600,
      },
    });
    empIds[e.empId] = rec.id;
  }
  console.log(`  ✓ ${EMPLOYEES.length} employees`);

  // 3) attendance (current month) for active employees
  let attCount = 0;
  for (let i = 0; i < EMPLOYEES.length; i++) {
    const e = EMPLOYEES[i];
    if (e.left) continue;
    for (let day = 1; day <= 28; day++) {
      const status = attendanceStatus(i, day);
      if (!status) continue;
      const date = new Date(Date.UTC(2026, 5, day));
      await prisma.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId: empIds[e.empId], date } },
        update: { status },
        create: { employeeId: empIds[e.empId], date, status },
      });
      attCount++;
    }
  }
  console.log(`  ✓ ${attCount} attendance records (June 2026)`);

  // 4) payroll — last 6 months for active employees
  let payCount = 0;
  for (const e of EMPLOYEES) {
    if (e.left) continue;
    for (let mi = 0; mi < MONTHS.length; mi++) {
      const month = MONTHS[mi];
      const p = payrollFor(e.gross, mi);
      await prisma.payrollRecord.upsert({
        where: { employeeId_periodYear_periodMonth: { employeeId: empIds[e.empId], periodYear: 2026, periodMonth: month } },
        update: p,
        create: { employeeId: empIds[e.empId], periodYear: 2026, periodMonth: month, designation: e.designation, doj: D(e.doj), ctc: e.gross * 12, ...p },
      });
      payCount++;
    }
  }
  console.log(`  ✓ ${payCount} payslips`);

  // 5) projects + assignments (some concurrent)
  const PROJECTS = [
    { code: "GNE-P-A", name: "Rajasthan 50MW Solar", client: "NTPC", status: "ACTIVE" as const },
    { code: "GNE-P-B", name: "Gujarat Rooftop Phase 2", client: "Adani", status: "ACTIVE" as const },
    { code: "GNE-P-C", name: "Karnataka Substation", client: "BESCOM", status: "ON_HOLD" as const },
  ];
  const projIds: Record<string, string> = {};
  for (const p of PROJECTS) {
    const rec = await prisma.project.upsert({ where: { code: p.code }, update: {}, create: { ...p, startDate: D("2026-01-01") } });
    projIds[p.code] = rec.id;
  }
  const ASSIGN: [string, string, string, number][] = [
    ["GNE-E001", "GNE-P-A", "Engineer", 60], ["GNE-E001", "GNE-P-B", "Support", 40],
    ["GNE-E002", "GNE-P-A", "Lead Engineer", 100],
    ["GNE-E003", "GNE-P-A", "Project Manager", 50], ["GNE-E003", "GNE-P-B", "Project Manager", 50],
    ["GNE-E004", "GNE-P-B", "Technician", 100],
  ];
  for (const [emp, proj, role, alloc] of ASSIGN) {
    await prisma.projectAssignment.upsert({
      where: { employeeId_projectId: { employeeId: empIds[emp], projectId: projIds[proj] } },
      update: { roleOnProject: role, allocationPct: alloc },
      create: { employeeId: empIds[emp], projectId: projIds[proj], roleOnProject: role, allocationPct: alloc, startDate: D("2026-02-01") },
    });
  }
  console.log(`  ✓ ${PROJECTS.length} projects, ${ASSIGN.length} assignments`);

  // 6) a couple of assets
  for (const [emp, make] of [["GNE-E001", "Dell Latitude 5440"], ["GNE-E003", "MacBook Pro 14"]] as const) {
    const has = await prisma.employeeAsset.count({ where: { employeeId: empIds[emp] } });
    if (has === 0) {
      await prisma.employeeAsset.create({
        data: { employeeId: empIds[emp], hasLaptop: true, makeModel: make, lpSerialNo: "SN" + emp.slice(-3), lpCategory: "Standard", oemName: make.split(" ")[0], laptopBag: true, mouse: true, charger: true, idCard: true },
      });
    }
  }
  console.log("  ✓ assets");

  // 7) a few vendors (SCM)
  const VENDORS = [
    { id: "demo-vendor-1", companyName: "SunPower Modules Pvt Ltd", email: "sales@sunpower.test", state: "Gujarat", status: "APPROVED" as const, vendorCode: "GNE-V-0001", gstNo: "24ABCDE1234F1Z5", offersProduct: true, oemOrDealer: "OEM" },
    { id: "demo-vendor-2", companyName: "VoltEdge Cables", email: "info@voltedge.test", state: "Maharashtra", status: "UNDER_REVIEW" as const, offersProduct: true, oemOrDealer: "DEALER" },
    { id: "demo-vendor-3", companyName: "GreenMount Structures", email: "contact@greenmount.test", state: "Tamil Nadu", status: "SUBMITTED" as const, offersService: true },
    { id: "demo-vendor-4", companyName: "InverTech Solutions", email: "hello@invertech.test", state: "Karnataka", status: "APPROVED" as const, vendorCode: "GNE-V-0002", offersProduct: true, oemOrDealer: "OEM" },
  ];
  for (const v of VENDORS) {
    await prisma.vendor.upsert({ where: { id: v.id }, update: {}, create: v });
  }
  console.log(`  ✓ ${VENDORS.length} vendors`);

  // 8) BD module — client list (from the tracker) + a working pipeline
  if ((await prisma.bdClient.count()) === 0) {
    await prisma.bdClient.createMany({ data: BD_CLIENTS });
    console.log(`  ✓ ${BD_CLIENTS.length} BD clients (tracker client list)`);
  } else {
    console.log("  ✓ BD clients already present — skipped");
  }
  const clientId = async (name: string) => {
    const c = await prisma.bdClient.findFirst({ where: { name } });
    if (!c) throw new Error(`BD client missing from seed: ${name}`);
    return c.id;
  };

  if ((await prisma.bdEnquiry.count()) === 0) {
    const jakson = await clientId("Jakson");
    const oriana = await clientId("Oriana Power");
    const bondada = await clientId("Bondada");
    const ntpc = await clientId("NTPC Re Ltd");
    const azure = await clientId("Azure Power");
    const jmb = await clientId("JMB");

    const wonEnquiry = await prisma.bdEnquiry.create({
      data: {
        fiscalYear: "FY 26-27", enquiryDate: D("2026-05-12"), enquiryType: "O&M", clientId: ntpc,
        personName: "R. Sharma", contactNo: "9811001100", location: "Bhadla, Rajasthan",
        projectType: "Ground-mount O&M", activities: "Annual O&M contract for 40 MW block",
        unit: "kW", qty: 40000, quoteNo: "GNE/Q/26-27/009", submissionDate: D("2026-05-28"),
        probabilityPct: 100, forecastedRevenue: 9200000, stage: "CLOSED", finalStatus: "WON",
        customerContact: "S. Iyer", value: 9200000,
      },
    });
    await prisma.bdEnquiry.createMany({
      data: [
        {
          fiscalYear: "FY 26-27", enquiryDate: D("2026-06-02"), enquiryType: "O&M", clientId: jakson,
          personName: "A. Mehta", contactNo: "9899887766", location: "Delhi NCR",
          projectType: "Rooftop O&M", activities: "Quarterly cleaning + preventive maintenance, 14 sites",
          unit: "kW", qty: 2500, quoteNo: "GNE/Q/26-27/014", submissionDate: D("2026-06-18"),
          projectStatus: "Commercial review", probabilityPct: 70, forecastedRevenue: 3360000,
          stage: "QUOTE_SUBMITTED", finalStatus: "OPEN", expectedClosure: D("2026-08-15"),
          customerContact: "P. Nair", value: 4800000,
        },
        {
          fiscalYear: "FY 26-27", enquiryDate: D("2026-05-20"), enquiryType: "EPC", clientId: oriana,
          personName: "K. Joshi", contactNo: "9822334455", location: "Jaipur, Rajasthan",
          projectType: "Ground-mount EPC", activities: "BOS + installation for 8 MW",
          unit: "MW", qty: 8, quoteNo: "GNE/Q/26-27/011", submissionDate: D("2026-06-05"),
          projectStatus: "Negotiating rates", probabilityPct: 60, forecastedRevenue: 7500000,
          stage: "NEGOTIATION", finalStatus: "OPEN", expectedClosure: D("2026-09-30"),
          value: 12500000,
        },
        {
          fiscalYear: "FY 26-27", enquiryDate: D("2026-06-26"), enquiryType: "EPC", clientId: bondada,
          personName: "V. Rao", location: "Hyderabad", projectType: "Ground-mount EPC",
          activities: "Site survey requested", unit: "MW", qty: 12,
          stage: "ENQUIRY", finalStatus: "OPEN",
        },
        {
          fiscalYear: "FY 26-27", enquiryDate: D("2026-04-15"), enquiryType: "O&M", clientId: azure,
          location: "Pune", projectType: "Rooftop O&M", unit: "kW", qty: 1800,
          quoteNo: "GNE/Q/26-27/004", submissionDate: D("2026-04-28"), probabilityPct: 0,
          stage: "CLOSED", finalStatus: "LOST", value: 3000000,
          notes: "Lost on price — incumbent renewed at lower rate.",
        },
        {
          fiscalYear: "FY 25-26", enquiryDate: D("2026-01-10"), enquiryType: "O&M", clientId: jmb,
          location: "Lucknow", projectType: "Rooftop O&M", unit: "kW", qty: 900,
          quoteNo: "GNE/Q/25-26/031", submissionDate: D("2026-01-22"), probabilityPct: 100,
          forecastedRevenue: 2100000, stage: "CLOSED", finalStatus: "WON", value: 2100000,
        },
      ],
    });

    await prisma.bdPurchaseOrder.createMany({
      data: [
        {
          fiscalYear: "FY 26-27", receivedDate: D("2026-06-25"), projectType: "Ground-mount O&M",
          clientId: ntpc, activities: "Annual O&M contract for 40 MW block", quoteNo: "GNE/Q/26-27/009",
          enquiryId: wonEnquiry.id, projectQty: "40 MW", projectPeriod: "12 months",
          poNumber: "NTPC/PO/2026/118", poValue: 9200000, poDate: D("2026-06-24"),
          poStart: D("2026-07-01"), poEnd: D("2027-06-30"),
        },
        {
          fiscalYear: "FY 25-26", receivedDate: D("2026-02-05"), projectType: "Rooftop O&M",
          clientId: jmb, activities: "O&M for 900 kW rooftop portfolio", quoteNo: "GNE/Q/25-26/031",
          projectQty: "900 kW", projectPeriod: "12 months", poNumber: "JMB-PO-0093",
          poValue: 2100000, poDate: D("2026-02-03"), poStart: D("2026-03-01"), poEnd: D("2027-02-28"),
        },
        {
          fiscalYear: "FY 25-26", receivedDate: D("2025-11-18"), projectType: "Rooftop O&M",
          clientId: jakson, activities: "Preventive maintenance, 6 sites", projectQty: "1.4 MW",
          projectPeriod: "9 months", poNumber: "JKS/PO/8821", poValue: 1450000,
          poDate: D("2025-11-15"), poStart: D("2025-12-01"), poEnd: D("2026-08-31"),
          remarks: "Extension likely on completion.",
        },
      ],
    });
    console.log("  ✓ BD pipeline (6 enquiries, 3 POs)");
  } else {
    console.log("  ✓ BD pipeline already present — skipped");
  }

  if ((await prisma.bdTarget.count()) === 0) {
    await prisma.bdTarget.createMany({
      data: [
        {
          fiscalYear: "FY 26-27", quarter: "Q1", states: "Delhi NCR, UP", keyAccountPerson: "Vinod Saini",
          project: "Rooftop O&M portfolio", serviceType: "OM", plantType: "ROOF", projectSize: "5 MW",
          locations: 12, estimatedValue: 15000000, probabilityPct: 60, forecastedRevenue: 9000000,
          orderReceived: 2500000,
        },
        {
          fiscalYear: "FY 26-27", quarter: "Q2", states: "Rajasthan", keyAccountPerson: "Vinod Saini",
          project: "Ground-mount EPC", serviceType: "EPC", plantType: "GROUND", projectSize: "20 MW",
          locations: 2, estimatedValue: 60000000, probabilityPct: 40, forecastedRevenue: 24000000,
          orderReceived: 0,
        },
        {
          fiscalYear: "FY 26-27", quarter: "Q3", states: "Karnataka, Tamil Nadu", keyAccountPerson: "B. Iyer",
          project: "Hybrid O&M", serviceType: "EPC_OM", plantType: "HYBRID", projectSize: "10 MW",
          locations: 4, estimatedValue: 22000000, probabilityPct: 35, forecastedRevenue: 7700000,
          orderReceived: 0,
        },
        {
          fiscalYear: "FY 25-26", quarter: "Q4", states: "UP, Bihar", keyAccountPerson: "Vinod Saini",
          project: "Rooftop O&M", serviceType: "OM", plantType: "ROOF", projectSize: "3 MW",
          locations: 8, estimatedValue: 9000000, probabilityPct: 80, forecastedRevenue: 7200000,
          orderReceived: 6400000,
        },
      ],
    });
    console.log("  ✓ 4 BD target lines");
  } else {
    console.log("  ✓ BD targets already present — skipped");
  }

  // 9) Finance module — one invoice in each workflow state
  const invoiceCount = await prisma.invoice.count();
  if (invoiceCount === 0) {
    // APPROVED + PAID — the full happy path, ready to print all three documents.
    await prisma.invoice.create({
      data: {
        invoiceNo: "GNE/26-27/0001", invoiceDate: D("2026-06-10"),
        orderNo: "JKS/PO/8821", orderDate: D("2025-11-15"),
        contactPerson: "A. Mehta", contactNumber: "9899887766",
        billTo: "Jakson Limited\nA-43, Sector 63\nNoida, UP – 201301\nGSTIN: 09AABCJ4664L1ZM",
        shipTo: "Jakson Limited\nRooftop sites — Delhi NCR cluster",
        gstLabel: "IGST", gstRate: 18, subtotal: 450000, gstAmount: 81000, total: 531000,
        status: "APPROVED", paymentStatus: "PAID",
        paymentDate: D("2026-06-28"), paymentRef: "UTR-HDFC0483-99120", paymentMarkedBy: "Farhan (Finance)",
        createdByName: "Farhan (Finance)",
        submittedByName: "Farhan (Finance)", submittedAt: new Date("2026-06-12T09:30:00.000Z"),
        decidedByName: "Anita Admin", decidedByRole: "ADMIN",
        decidedAt: new Date("2026-06-13T14:05:00.000Z"),
        decisionRemarks: "Cleared against PO JKS/PO/8821.",
        items: {
          create: [
            { description: "O&M services — rooftop solar portfolio, June 2026 (6 sites)", sacCode: "998717", qty: 1, uom: "Job", rate: 300000, amount: 300000, sortOrder: 0 },
            { description: "Module cleaning cycles — additional visits", sacCode: "998717", qty: 3, uom: "Visit", rate: 50000, amount: 150000, sortOrder: 1 },
          ],
        },
        nopa: {
          create: {
            nopaNo: "NOPA/26-27/0001", nopaDate: D("2026-06-12"),
            plantName: "Jakson rooftop portfolio — Delhi NCR", partyName: "Jakson Limited",
            itemDescription: "O&M services + module cleaning, June 2026", poRef: "JKS/PO/8821",
            gstRate: 18, basicAmount: 450000, gstAmount: 81000, grandTotal: 531000,
            dueDate: D("2026-07-10"), bankName: "HDFC Bank", accountNo: "50200102008242",
            ifsc: "HDFC0000483", branchName: "New Delhi", initiatedBy: "Farhan (Finance)",
            checkedBy: "Neha Gupta",
            lines: {
              create: [
                { description: "O&M services — June 2026", qtyWords: "One Job", uom: "Job", unitPrice: 300000, amount: 300000, sortOrder: 0 },
                { description: "Module cleaning — additional visits", qtyWords: "Three Visits", uom: "Visit", unitPrice: 50000, amount: 150000, sortOrder: 1 },
              ],
            },
          },
        },
      },
    });

    // PENDING_APPROVAL — sitting in the approval queue.
    await prisma.invoice.create({
      data: {
        invoiceNo: "GNE/26-27/0002", invoiceDate: D("2026-06-26"),
        orderNo: "NTPC/PO/2026/118", orderDate: D("2026-06-24"),
        contactPerson: "R. Sharma", contactNumber: "9811001100",
        billTo: "NTPC Renewable Energy Ltd\nBhadla Solar Park\nJodhpur, Rajasthan – 342301",
        gstLabel: "IGST", gstRate: 18, subtotal: 766667, gstAmount: 138000, total: 904667,
        status: "PENDING_APPROVAL",
        createdByName: "Farhan (Finance)",
        submittedByName: "Farhan (Finance)", submittedAt: new Date("2026-06-27T11:15:00.000Z"),
        items: {
          create: [
            { description: "O&M mobilisation — 40 MW block, month 1 of 12", sacCode: "998717", qty: 1, uom: "Month", rate: 766667, amount: 766667, sortOrder: 0 },
          ],
        },
        nopa: {
          create: {
            nopaNo: "NOPA/26-27/0002", nopaDate: D("2026-06-27"),
            plantName: "Bhadla 40 MW block", partyName: "NTPC Renewable Energy Ltd",
            itemDescription: "O&M mobilisation — month 1", poRef: "NTPC/PO/2026/118",
            gstRate: 18, basicAmount: 766667, gstAmount: 138000, grandTotal: 904667,
            dueDate: D("2026-07-30"), bankName: "HDFC Bank", accountNo: "50200102008242",
            ifsc: "HDFC0000483", branchName: "New Delhi", initiatedBy: "Farhan (Finance)",
            lines: {
              create: [
                { description: "O&M mobilisation — month 1 of 12", qtyWords: "One Month", uom: "Month", unitPrice: 766667, amount: 766667, sortOrder: 0 },
              ],
            },
          },
        },
      },
    });

    // REJECTED — sent back with remarks, editable + resubmittable.
    await prisma.invoice.create({
      data: {
        invoiceNo: "GNE/26-27/0003", invoiceDate: D("2026-06-18"),
        orderNo: "ONX/WO/2026/77",
        billTo: "Onix Renewable Pvt Ltd\nAhmedabad, Gujarat – 380054",
        gstLabel: "IGST", gstRate: 18, subtotal: 220000, gstAmount: 39600, total: 259600,
        status: "REJECTED",
        createdByName: "Farhan (Finance)",
        submittedByName: "Farhan (Finance)", submittedAt: new Date("2026-06-19T08:45:00.000Z"),
        decidedByName: "Manish Manager", decidedByRole: "MANAGER",
        decidedAt: new Date("2026-06-20T10:20:00.000Z"),
        decisionRemarks: "Rate does not match the work order — correct line 1 and resubmit.",
        items: {
          create: [
            { description: "Site survey and DPR — 12 MW ground-mount", sacCode: "998339", qty: 1, uom: "Job", rate: 220000, amount: 220000, sortOrder: 0 },
          ],
        },
        nopa: {
          create: {
            nopaNo: "NOPA/26-27/0003", nopaDate: D("2026-06-19"),
            plantName: "Onix 12 MW site", partyName: "Onix Renewable Pvt Ltd",
            itemDescription: "Site survey and DPR", poRef: "ONX/WO/2026/77",
            gstRate: 18, basicAmount: 220000, gstAmount: 39600, grandTotal: 259600,
            dueDate: D("2026-07-20"), initiatedBy: "Farhan (Finance)",
            lines: {
              create: [
                { description: "Site survey and DPR — 12 MW", qtyWords: "One Job", uom: "Job", unitPrice: 220000, amount: 220000, sortOrder: 0 },
              ],
            },
          },
        },
      },
    });

    // DRAFT — still being prepared.
    await prisma.invoice.create({
      data: {
        invoiceNo: "GNE/26-27/0004", invoiceDate: D("2026-07-01"),
        billTo: "Oriana Power Ltd\nNoida, UP – 201301",
        gstLabel: "IGST", gstRate: 18, subtotal: 380000, gstAmount: 68400, total: 448400,
        status: "DRAFT",
        createdByName: "Farhan (Finance)",
        notes: "Awaiting final BOQ confirmation before submission.",
        items: {
          create: [
            { description: "EPC advance — BOS supply milestone 1", sacCode: "995461", qty: 1, uom: "Milestone", rate: 380000, amount: 380000, sortOrder: 0 },
          ],
        },
      },
    });
    console.log("  ✓ 4 invoices (paid / pending / rejected / draft) with NOPAs");
  } else {
    console.log(`  ✓ invoices already present (${invoiceCount}) — skipped`);
  }

  console.log("\nDemo seed complete.");
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
