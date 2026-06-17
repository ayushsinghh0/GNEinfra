import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { dprGridSchema, toDate } from "@/lib/project-schemas";

// PUT /api/projects/[id]/dpr/grid (admin) — bulk upsert/delete daily cells.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = dprGridSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const cells = parsed.data.cells;

  // All referenced activities must belong to this project.
  const ids = [...new Set(cells.map((c) => c.activityId))];
  const acts = await prisma.projectActivity.findMany({
    where: { id: { in: ids } },
    select: { id: true, projectId: true, totalQty: true, uom: true },
  });
  const byId = new Map(acts.map((a) => [a.id, a]));
  for (const c of cells) {
    const a = byId.get(c.activityId);
    if (!a || a.projectId !== id) {
      return NextResponse.json({ error: "An activity does not belong to this project" }, { status: 404 });
    }
  }

  // Normalise dates; reject unparseable.
  const norm = cells.map((c) => ({ ...c, d: toDate(c.date) }));
  if (norm.some((c) => !c.d)) {
    return NextResponse.json({ error: "Invalid date in one of the cells" }, { status: 400 });
  }

  // Cap re-check per activity: existing VALUE sum (excluding the dates in this
  // batch) + the batch's VALUE qty must not exceed totalQty.
  for (const a of acts) {
    if (a.totalQty == null || a.totalQty <= 0) continue;
    const batch = norm.filter((c) => c.activityId === a.id);
    const batchDates = batch.map((c) => c.d as Date);
    const agg = await prisma.dprEntry.aggregate({
      where: { activityId: a.id, kind: "VALUE", date: { notIn: batchDates } },
      _sum: { qtyDone: true },
    });
    const others = agg._sum.qtyDone ?? 0;
    const batchValue = batch.reduce((s, c) => s + (c.kind === "VALUE" ? (c.qtyDone ?? 0) : 0), 0);
    if (others + batchValue > a.totalQty + 1e-6) {
      const remaining = Math.max(0, a.totalQty - others);
      const uom = a.uom ? ` ${a.uom}` : "";
      const fmt = (n: number) => Number(n.toFixed(2)).toLocaleString("en-IN");
      return NextResponse.json(
        { error: `One activity would exceed its planned ${fmt(a.totalQty)}${uom}; at most ${fmt(remaining)}${uom} more can be logged.` },
        { status: 400 }
      );
    }
  }

  // Apply in one transaction. A NONE cell with no value deletes that date's entry.
  await prisma.$transaction(
    norm.map((c) => {
      const date = c.d as Date;
      if (c.kind === "NONE" && (c.qtyDone == null)) {
        return prisma.dprEntry.deleteMany({ where: { activityId: c.activityId, date } });
      }
      const qty = c.kind === "VALUE" ? (c.qtyDone ?? 0) : 0;
      return prisma.dprEntry.upsert({
        where: { activityId_date: { activityId: c.activityId, date } },
        update: { qtyDone: qty, kind: c.kind },
        create: { activityId: c.activityId, date, qtyDone: qty, kind: c.kind },
      });
    })
  );

  return NextResponse.json({ ok: true });
}
