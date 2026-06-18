import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { buildFullProjectWorkbook } from "@/lib/workbook";

// GET /api/projects/[id]/workbook — download the project's full P0 workbook: one
// .xlsx with a sheet per available source sheet (Project Details, Activity DPR,
// BOQ, PO & MRC / Materials, Activities) in the master-workbook source order.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      boqItems: { orderBy: [{ category: "asc" }, { createdAt: "asc" }] },
      materials: { orderBy: { createdAt: "asc" } },
      activities: {
        orderBy: { id: "asc" },
        include: { entries: { orderBy: { date: "asc" } } },
      },
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buf = await buildFullProjectWorkbook({
    gneId: project.gneId,
    clientName: project.clientName,
    tenderId: project.tenderId,
    state: project.state,
    cluster: project.cluster,
    plantName: project.plantName,
    capacityAcMw: project.capacityAcMw,
    capacityDcMw: project.capacityDcMw,
    epcScope: project.epcScope,
    poNumber: project.poNumber,
    poValueCr: project.poValueCr,
    subPartner: project.subPartner,
    startDate: project.startDate,
    liveDate: project.liveDate,
    completeDate: project.completeDate,
    handoverDate: project.handoverDate,
    plantAddress: project.plantAddress,
    clientAddress: project.clientAddress,
    boqItems: project.boqItems.map((b) => ({
      category: b.category,
      section: b.section,
      serialNo: b.serialNo,
      description: b.description,
      rating: b.rating,
      specification: b.specification,
      uom: b.uom,
      quantity: b.quantity,
      blockQty: (b.blockQty ?? null) as Record<string, number> | null,
      unitRate: b.unitRate,
      responsibility: b.responsibility,
    })),
    materials: project.materials.map((m) => ({
      partner: m.partner,
      type: m.type,
      description: m.description,
      uom: m.uom,
      approvedQty: m.approvedQty,
      receivedQty: m.receivedQty,
      receivedDate: m.receivedDate,
      deliveryDate: m.deliveryDate,
      mdcc: m.mdcc,
      signoffBel: m.signoffBel,
      mahagenco: m.mahagenco,
      drawingApproved: m.drawingApproved,
      poReleased: m.poReleased,
      qualitySignoff: m.qualitySignoff,
      mrcStatus: m.mrcStatus,
      paymentStatus: m.paymentStatus,
      remarks: m.remarks,
    })),
    activities: project.activities.map((a) => ({
      activitySerial: a.activitySerial,
      activity: a.activity,
      subActivity: a.subActivity,
      uom: a.uom,
      totalQty: a.totalQty,
      startDate: a.startDate,
      endDate: a.endDate,
      entries: a.entries.map((e) => ({
        date: e.date,
        qtyDone: e.qtyDone,
        kind: e.kind,
      })),
    })),
  });

  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Project-${project.gneId}.xlsx"`,
    },
  });
}
