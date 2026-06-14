import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
      boqItems: {
        create: [
          { category: "SUPPLY", section: "Modules", serialNo: "1", description: "Modules", rating: "590 Wp", uom: "Nos", specification: "Monocrystalline Mono-PERC", quantity: 32212 },
          { category: "SUPPLY", section: "Inverters", serialNo: "1", description: "Central Inverter", rating: "3.3 MW", uom: "Nos", quantity: 6 },
          { category: "SUPPLY", section: "MMS", description: "2Px28 PV OUTER TABLE", uom: "Nos", quantity: 172 },
          { category: "SUPPLY", section: "MMS", description: "2Px14 PV OUTER TABLE", uom: "Nos", quantity: 405 },
          { category: "SUPPLY", section: "Major BOS", serialNo: "1", description: "Inverter Duty Transformer", rating: "5000 KVA", uom: "Nos", specification: "11KV/0.660kV, Ynd11, ONAN", quantity: 3 },
          { category: "SUPPLY", section: "Major BOS", serialNo: "2", description: "SCMB", rating: "12 In 1 Out", uom: "Nos", quantity: 54 },
          { category: "SERVICE", section: "Infrastructure Development", serialNo: "13", description: "Boundary Fencing", uom: "Mtr", specification: "As per approved GA Drawing", quantity: 6702 },
          { category: "SERVICE", section: "Piling Works", serialNo: "1", description: "MMS Pile Foundations", uom: "Nos", quantity: 7104 },
          { category: "LINE_WORK", section: "Plant to GSS line", serialNo: "1", description: "11KV OH/UG line from Comm. point", uom: "Mtr", quantity: 4500, responsibility: "KP" },
        ],
      },
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
      materials: {
        create: [
          { partner: "Datum", type: "BOS", description: "Fencing", uom: "Mtr", approvedQty: 4500, drawingApproved: true, poReleased: true, receivedQty: 4500, receivedDate: new Date("2025-08-07"), qualitySignoff: true, mrcStatus: "Done" },
          { partner: "Datum", type: "BOS", description: "MMS Column", uom: "Nos", approvedQty: 6636, drawingApproved: true, poReleased: true, receivedQty: 6692, receivedDate: new Date("2025-12-04"), qualitySignoff: true, mrcStatus: "WIP" },
          { partner: "Datum", type: "BOS", description: "Quta Cabin", uom: "Nos", approvedQty: 1, drawingApproved: false, poReleased: false, mrcStatus: "Pending" },
          { partner: "Datum", type: "Supply", description: "Modules 590Wp", uom: "Nos", approvedQty: 32212, drawingApproved: true, poReleased: true, receivedQty: 18000, receivedDate: new Date("2026-01-15"), mrcStatus: "WIP" },
        ],
      },
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

  // Activities with daily DPR entries.
  const activities: {
    activity: string;
    subActivity?: string;
    uom: string;
    totalQty: number;
    entries: [string, number][];
  }[] = [
    { activity: "Topographical Survey", subActivity: "Topo survey", uom: "Acres", totalQty: 60, entries: [["2025-08-30", 20], ["2025-08-31", 20], ["2025-09-01", 20]] },
    { activity: "Fencing", subActivity: "Boundary", uom: "Mtr", totalQty: 6702, entries: [["2025-09-05", 770], ["2025-09-06", 1110], ["2025-09-07", 900], ["2025-09-08", 1473]] },
    { activity: "MMS Pile Casting", subActivity: "Piling", uom: "Nos", totalQty: 7104, entries: [["2025-10-01", 400], ["2025-10-02", 520], ["2025-10-03", 610], ["2025-10-04", 480]] },
    { activity: "Module Mounting", subActivity: "MMS Install", uom: "Nos", totalQty: 32212, entries: [["2025-11-10", 1200], ["2025-11-11", 1500], ["2025-11-12", 1800]] },
  ];

  for (const a of activities) {
    await prisma.projectActivity.create({
      data: {
        projectId: project.id,
        activity: a.activity,
        subActivity: a.subActivity,
        uom: a.uom,
        totalQty: a.totalQty,
        startDate: new Date(a.entries[0][0]),
        entries: { create: a.entries.map(([d, q]) => ({ date: new Date(d), qtyDone: q })) },
      },
    });
  }

  console.log("Seeded project", project.gneId, project.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
