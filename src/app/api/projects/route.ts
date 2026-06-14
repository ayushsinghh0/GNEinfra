import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { projectSchemaCreate } from "@/lib/validation";

// POST /api/projects  (admin only)
// Creates a project from the New Project form.
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = projectSchemaCreate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const d = parsed.data;

  // startDate string -> Date (only if it parses to a valid date).
  let startDate: Date | undefined;
  if (d.startDate) {
    const parsedDate = new Date(d.startDate);
    if (!isNaN(parsedDate.getTime())) startDate = parsedDate;
  }

  try {
    const project = await prisma.project.create({
      data: {
        gneId: d.gneId,
        clientName: d.clientName,
        tenderId: d.tenderId,
        state: d.state,
        cluster: d.cluster,
        plantName: d.plantName,
        capacityAcMw: d.capacityAcMw,
        capacityDcMw: d.capacityDcMw,
        epcScope: d.epcScope,
        poNumber: d.poNumber,
        poValueCr: d.poValueCr,
        subPartner: d.subPartner,
        vendorId: d.vendorId || undefined,
        plantAddress: d.plantAddress,
        clientAddress: d.clientAddress,
        stage: d.stage,
        startDate,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: project.id });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A project with that GNE ID already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Could not create the project." },
      { status: 500 }
    );
  }
}
