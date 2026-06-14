import { PrismaClient } from "@prisma/client";
import boqGhargaon from "./boq-ghargaon.json";
import dprShivoor from "./dpr-shivoor.json";
import mrcShivoor from "./mrc-shivoor.json";

const prisma = new PrismaClient();

function d(v: string | null | undefined): Date | null {
  if (!v) return null;
  const dt = new Date(v);
  return isNaN(dt.getTime()) ? null : dt;
}

type DprRow = {
  activity: string;
  subActivity: string | null;
  uom: string | null;
  totalQty: number | null;
  cumulative: number | null;
  startDate: string | null;
  endDate: string | null;
};
type MrcRow = {
  partner: string | null;
  type: string | null;
  description: string;
  uom: string | null;
  approvedQty: number | null;
  receivedQty: number | null;
  receivedDate: string | null;
  drawingApproved: boolean;
  poReleased: boolean;
  qualitySignoff: boolean;
  mrcStatus: string | null;
  paymentStatus: string | null;
  remarks: string | null;
};

// 225 real DPR activities for Shivoor; create one summarising progress entry
// (= cumulative qty) for each activity that has progress.
const activityCreate = (dprShivoor as DprRow[]).map((a) => {
  const entryDate = d(a.endDate) ?? d(a.startDate) ?? new Date("2026-02-10");
  return {
    activity: a.activity,
    subActivity: a.subActivity ?? undefined,
    uom: a.uom ?? undefined,
    totalQty: a.totalQty ?? undefined,
    startDate: d(a.startDate) ?? undefined,
    endDate: d(a.endDate) ?? undefined,
    entries:
      a.cumulative && a.cumulative > 0
        ? { create: [{ date: entryDate, qtyDone: a.cumulative }] }
        : undefined,
  };
});

// 72 real PO & MRC rows for Shivoor.
const materialCreate = (mrcShivoor as MrcRow[]).map((m) => ({
  partner: m.partner ?? undefined,
  type: m.type ?? undefined,
  description: m.description,
  uom: m.uom ?? undefined,
  approvedQty: m.approvedQty ?? undefined,
  receivedQty: m.receivedQty ?? undefined,
  receivedDate: d(m.receivedDate) ?? undefined,
  drawingApproved: m.drawingApproved,
  poReleased: m.poReleased,
  qualitySignoff: m.qualitySignoff,
  mrcStatus: m.mrcStatus ?? undefined,
  paymentStatus: m.paymentStatus ?? undefined,
  remarks: m.remarks ?? undefined,
}));

type BoqRow = {
  category: string;
  section: string | null;
  serialNo: string | null;
  description: string;
  rating: string | null;
  specification: string | null;
  uom: string | null;
  quantity: number | null;
  responsibility?: string | null;
};

// All BOQ line items extracted from the BOQ-Ghargaon workbook (BOM-Supply,
// BOM-Service, Line work) — 171 rows across every section.
const boqCreate = (boqGhargaon as BoqRow[]).map((b) => ({
  category: b.category as "SUPPLY" | "SERVICE" | "LINE_WORK",
  section: b.section ?? undefined,
  serialNo: b.serialNo ?? undefined,
  description: b.description,
  rating: b.rating ?? undefined,
  specification: b.specification ?? undefined,
  uom: b.uom ?? undefined,
  quantity: b.quantity ?? undefined,
  responsibility: b.responsibility ?? undefined,
}));

// Representative data drawn from the BOQ-Ghargaon + Project Details/DPR workbooks
// for one project (GNEi-0001, Shivoor) so the Project Management module shows
// real-looking data. Idempotent: re-running replaces this project.
async function main() {
  await prisma.project.deleteMany({ where: { gneId: "GNEi-0001" } });

  const project = await prisma.project.create({
    data: {
      gneId: "GNEi-0001",
      clientName: "BEL",
      tenderId: "569",
      state: "MH",
      cluster: "Shambhajinagar",
      plantName: "Shivoor",
      capacityAcMw: 13,
      capacityDcMw: 16.9,
      epcScope: "EPC, Without PV",
      poNumber: "BEMHPO60244",
      poValueCr: 18,
      subPartner: "Datum",
      plantAddress: "Shivoor, Maharashtra",
      clientAddress: "Bondada Engineering Ltd",
      stage: "CONSTRUCTION",
      startDate: new Date("2026-05-16"),
      blocks: { create: [{ name: "Block-1" }, { name: "Block-2" }, { name: "Block-3" }] },
      boqItems: { create: boqCreate },
      milestones: {
        create: [
          { name: "Topographical Survey", category: "Engineering", plannedDate: new Date("2025-05-08"), actualDate: new Date("2025-05-08"), status: "DONE", sortOrder: 1 },
          { name: "Soil Test", category: "Engineering", plannedDate: new Date("2025-05-20"), actualDate: new Date("2025-05-22"), status: "DONE", sortOrder: 2 },
          { name: "Civil Mix Design", category: "Civil", plannedDate: new Date("2025-06-10"), status: "DONE", sortOrder: 3 },
          { name: "MMS Installation", category: "Civil", plannedDate: new Date("2025-09-15"), status: "IN_PROGRESS", sortOrder: 4 },
          { name: "Module Mounting", category: "Civil", plannedDate: new Date("2025-11-01"), status: "IN_PROGRESS", sortOrder: 5 },
          { name: "Inverter & IDT", category: "Electrical", plannedDate: new Date("2025-12-10"), status: "PENDING", sortOrder: 6 },
          { name: "Commissioning", category: "Testing", plannedDate: new Date("2026-02-15"), status: "PENDING", sortOrder: 7 },
          { name: "Plant Live", category: "Testing", plannedDate: new Date("2026-03-01"), status: "PENDING", sortOrder: 8 },
        ],
      },
      materials: { create: materialCreate },
      weatherLogs: {
        create: [
          { date: new Date("2025-05-16"), intensity: "HEAVY", fromTime: "14:57", toTime: "18:30", totalHours: 3.5, daysImpacted: 1 },
          { date: new Date("2025-05-23"), intensity: "HEAVY", fromTime: "10:45", toTime: "18:30", totalHours: 7.75, daysImpacted: 1 },
          { date: new Date("2025-06-05"), intensity: "MODERATE", fromTime: "14:00", toTime: "18:30", totalHours: 4.5, daysImpacted: 1 },
        ],
      },
      approvals: {
        create: [
          { parcel: "1", block: "B-1", item: "IDT", equipment: "4.5", capacityUom: "MVA", uom: "Nos", requiredQty: 1, receivedQty: 0 },
          { parcel: "1", block: "B-1", item: "Inverter", equipment: "4.4", capacityUom: "MVA", uom: "Nos", requiredQty: 1, receivedQty: 1, receivedAt: new Date("2025-12-20") },
          { parcel: "1", block: "B-1", item: "Modules", equipment: "590", capacityUom: "Wp", uom: "Nos", requiredQty: 10192, receivedQty: 6000, receivedAt: new Date("2026-01-15") },
        ],
      },
      safetyItems: {
        create: [
          { description: "Hard Hat", unit: "Set", qty: "Each person", available: true, remarks: "5 extra for visitors" },
          { description: "Eye Protective Equipment", unit: "Set", qty: "Each person", available: true },
          { description: "Safety Belts", unit: "Set", qty: "10", available: true },
          { description: "Insulated Tools", unit: "Set", qty: "1", available: false },
        ],
      },
    },
  });

  // 225 real DPR activities (with a summarising progress entry each).
  for (const a of activityCreate) {
    await prisma.projectActivity.create({
      data: { projectId: project.id, ...a },
    });
  }

  console.log(
    `Seeded ${project.gneId}: ${boqCreate.length} BOQ, ${activityCreate.length} activities, ${materialCreate.length} materials`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
