import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { parseMaterialsWorkbook } from "@/lib/materials-excel";

const MAX_BYTES = 5 * 1024 * 1024;

// POST /api/projects/[id]/materials/import — bulk-create materials (procurement
// items) from an uploaded .xlsx (multipart form-data, field "file").
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 5 MB" }, { status: 400 });
  }
  if (!/\.xlsx$/i.test(file.name)) {
    return NextResponse.json({ error: "Please upload an .xlsx file" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, skipped } = await parseMaterialsWorkbook(buffer, id);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found. Each row needs a Description. Use the template." },
        { status: 400 }
      );
    }
    await prisma.procurementItem.createMany({
      data: rows as Prisma.ProcurementItemCreateManyInput[],
    });
    return NextResponse.json({ ok: true, imported: rows.length, skipped });
  } catch (e) {
    return NextResponse.json(
      { error: "Could not read the file. Make sure it matches the template.", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}
