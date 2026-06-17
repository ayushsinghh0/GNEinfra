import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { projectEditSchema } from "@/lib/validation";

// PATCH /api/projects/<id>  (admin only) — edit any project field after creation.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = projectEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const d = parsed.data;
  const toD = (s?: string) => {
    if (!s) return null;
    const dt = new Date(s);
    return isNaN(dt.getTime()) ? null : dt;
  };
  try {
    await prisma.project.update({
      where: { id },
      data: {
        gneId: d.gneId,
        clientName: d.clientName ?? null,
        tenderId: d.tenderId ?? null,
        state: d.state ?? null,
        district: d.district ?? null,
        cluster: d.cluster ?? null,
        plantName: d.plantName ?? null,
        capacityAcMw: d.capacityAcMw ?? null,
        capacityDcMw: d.capacityDcMw ?? null,
        epcScope: d.epcScope ?? null,
        poNumber: d.poNumber ?? null,
        poValueCr: d.poValueCr ?? null,
        subPartner: d.subPartner ?? null,
        vendorId: d.vendorId || null,
        plantAddress: d.plantAddress ?? null,
        clientAddress: d.clientAddress ?? null,
        stage: d.stage,
        startDate: toD(d.startDate),
        liveDate: toD(d.liveDate),
        completeDate: toD(d.completeDate),
        handoverDate: toD(d.handoverDate),
      },
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002")
        return NextResponse.json({ error: "A project with that GNE ID already exists." }, { status: 409 });
      if (e.code === "P2025")
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not save the project." }, { status: 500 });
  }
}
