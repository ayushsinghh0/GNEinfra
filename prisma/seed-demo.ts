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

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Gne@2026";

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

  console.log("\nDemo seed complete.");
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
