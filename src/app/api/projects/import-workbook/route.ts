import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import {
  parseWorkbook,
  type ParsedProject,
  type ParsedActivity,
  type ParsedProcurement,
} from "@/lib/workbook";

const MAX_BYTES = 5 * 1024 * 1024;

// POST /api/projects/import-workbook — upload the full GNE master workbook
// ("Project Details & DPR") and auto-fill projects (admin only, multipart
// form-data, field "file"). For each Project Details row we upsert a Project by
// gneId, then (in a per-project transaction) replace its imported activities +
// DPR entries and procurement rows. Child sheets are matched to the project by
// normalized GNE ID. Unrecognised sheets and malformed rows are skipped + counted,
// never a hard failure — one bad row can't sink the upload.
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = await parseWorkbook(buffer);
  } catch (e) {
    return NextResponse.json(
      {
        error: "Could not read the workbook. Make sure it is the Project Details & DPR file.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 400 }
    );
  }

  if (parsed.projects.size === 0) {
    return NextResponse.json(
      {
        error:
          "No projects found. The workbook needs a 'Project Details' sheet with a 'GNE ID' column.",
      },
      { status: 400 }
    );
  }

  const results: {
    id: string;
    gneId: string;
    status: "created" | "updated";
    activities: number;
    procurement: number;
  }[] = [];
  const errors: { gneId: string; error: string }[] = [];

  let activitiesCreated = 0;
  let dprEntriesCreated = 0;
  let procurementCreated = 0;

  for (const [key, rec] of parsed.projects) {
    const acts = parsed.activities.get(key) ?? [];
    const procs = parsed.procurement.get(key) ?? [];
    try {
      const { id, status } = await importOneProject(rec, acts, procs);
      results.push({
        id,
        gneId: rec.gneId,
        status,
        activities: acts.length,
        procurement: procs.length,
      });
      for (const a of acts) dprEntriesCreated += a.entries.length;
      activitiesCreated += acts.length;
      procurementCreated += procs.length;
    } catch (e) {
      // A failure on one project (e.g. a transient DB error) must not abort the
      // rest of the import — record it and carry on.
      errors.push({ gneId: rec.gneId, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({
    ok: true,
    projects: results.map((r) => ({
      id: r.id,
      gneId: r.gneId,
      [r.status]: true,
      status: r.status,
      activities: r.activities,
      procurement: r.procurement,
    })),
    perSheet: {
      projectsCreated: results.filter((r) => r.status === "created").length,
      projectsUpdated: results.filter((r) => r.status === "updated").length,
      activities: activitiesCreated,
      dprEntries: dprEntriesCreated,
      procurement: procurementCreated,
      skipped: parsed.skipped,
      sheetsFound: parsed.sheetsFound,
    },
    errors,
  });
}

// Upsert one project by gneId, then replace its imported activities (+ DPR cells)
// and procurement rows, all in a single transaction so a partial write is never
// committed. Returns whether the project row was created or updated.
async function importOneProject(
  rec: ParsedProject,
  acts: ParsedActivity[],
  procs: ParsedProcurement[]
): Promise<{ id: string; status: "created" | "updated" }> {
  const fields = {
    clientName: rec.clientName,
    tenderId: rec.tenderId,
    state: rec.state,
    cluster: rec.cluster,
    plantName: rec.plantName,
    capacityAcMw: rec.capacityAcMw,
    capacityDcMw: rec.capacityDcMw,
    epcScope: rec.epcScope,
    poNumber: rec.poNumber,
    poValueCr: rec.poValueCr,
    subPartner: rec.subPartner,
    startDate: rec.startDate,
    liveDate: rec.liveDate,
    completeDate: rec.completeDate,
    handoverDate: rec.handoverDate,
    plantAddress: rec.plantAddress,
    clientAddress: rec.clientAddress,
  };

  const existing = await prisma.project.findUnique({
    where: { gneId: rec.gneId },
    select: { id: true },
  });
  const status: "created" | "updated" = existing ? "updated" : "created";

  const id = await prisma.$transaction(async (tx) => {
    const project = await tx.project.upsert({
      where: { gneId: rec.gneId },
      create: { gneId: rec.gneId, ...fields },
      update: fields,
      select: { id: true },
    });

    // Replace imported children so a re-upload is idempotent (no duplicates).
    // Cascades delete DprEntry rows with their parent ProjectActivity.
    await tx.projectActivity.deleteMany({ where: { projectId: project.id } });
    await tx.procurementItem.deleteMany({ where: { projectId: project.id } });

    for (let i = 0; i < acts.length; i++) {
      const a = acts[i];
      // Collapse duplicate dates (the unique [activityId,date] constraint) by
      // keeping the last write for a given day.
      const byDate = new Map<number, { date: Date; qtyDone: number; kind: "COM" | "VALUE" }>();
      for (const e of a.entries) byDate.set(e.date.getTime(), e);

      await tx.projectActivity.create({
        data: {
          projectId: project.id,
          activity: a.activity,
          subActivity: a.subActivity,
          uom: a.uom,
          totalQty: a.totalQty,
          startDate: a.startDate,
          endDate: a.endDate,
          activitySerial: a.activitySerial,
          sortOrder: i,
          entries: byDate.size
            ? {
                create: [...byDate.values()].map((e) => ({
                  date: e.date,
                  qtyDone: e.qtyDone,
                  kind: e.kind,
                })),
              }
            : undefined,
        },
      });
    }

    if (procs.length) {
      await tx.procurementItem.createMany({
        data: procs.map((p) => ({ projectId: project.id, ...p })),
      });
    }

    return project.id;
  });

  return { id, status };
}
