import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { boqSchema } from "@/lib/project-schemas";

// POST /api/projects/[id]/boq  (admin only)
// Adds a BOQ / scope line item to a project.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const body = await req.json().catch(() => null);
    const parsed = boqSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    // Read any per-block quantities from the raw body: keys like
    // "block_Block-1" -> blockQty["Block-1"] = number (skip empty/non-numeric).
    const blockQty: Record<string, number> = {};
    if (body && typeof body === "object") {
      for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
        if (!key.startsWith("block_")) continue;
        const name = key.slice("block_".length);
        if (!name) continue;
        const n = Number(value);
        if (typeof value !== "boolean" && value !== "" && value !== null && Number.isFinite(n)) {
          blockQty[name] = n;
        }
      }
    }
    const blockQtyData = Object.keys(blockQty).length > 0 ? blockQty : undefined;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await prisma.boqItem.create({
      data: {
        projectId: id,
        category: d.category,
        section: d.section,
        serialNo: d.serialNo,
        description: d.description,
        rating: d.rating,
        specification: d.specification,
        uom: d.uom,
        quantity: d.quantity,
        responsibility: d.responsibility,
        blockQty: blockQtyData,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not add the BOQ item." },
      { status: 500 }
    );
  }
}
