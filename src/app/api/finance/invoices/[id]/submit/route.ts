import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, FINANCE_WRITE } from "@/lib/rbac";
import { nopaSchema, computeNopaTotals } from "@/lib/finance-validation";

function toDate(s?: string) { const d = s ? new Date(s) : null; return d && !isNaN(d.getTime()) ? d : null; }

// Submitting for approval carries the full NOPA payload: the Note On Payment
// Approval is created (or replaced) and the invoice moves to PENDING_APPROVAL.
// Allowed from DRAFT / REJECTED (first submit, resubmit) and from
// PENDING_APPROVAL (correcting the NOPA while it waits). Never from APPROVED.
const SUBMITTABLE = new Set(["DRAFT", "REJECTED", "PENDING_APPROVAL"]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !FINANCE_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const { id } = await ctx.params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { status: true, nopa: { select: { id: true } } },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (!SUBMITTABLE.has(invoice.status)) {
    return NextResponse.json({ error: "An approved invoice cannot be resubmitted." }, { status: 409 });
  }
  const parsed = nopaSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;
  const nopaDate = toDate(d.nopaDate);
  if (!nopaDate) {
    return NextResponse.json({ error: "NOPA date is invalid" }, { status: 400 });
  }
  const { basicAmount, gstAmount, grandTotal } = computeNopaTotals(d.lines, d.gstRate);

  const nopaFields = {
    nopaNo: d.nopaNo,
    nopaDate,
    companyName: d.companyName || "Green Next Energy Infra Pvt Ltd",
    plantName: d.plantName || null,
    partyName: d.partyName || null,
    itemDescription: d.itemDescription || null,
    poRef: d.poRef || null,
    gstRate: d.gstRate,
    basicAmount,
    gstAmount,
    grandTotal,
    advancePaid: d.advancePaid,
    advanceRequest: d.advanceRequest,
    dueDate: toDate(d.dueDate),
    bankName: d.bankName || null,
    accountNo: d.accountNo || null,
    ifsc: d.ifsc || null,
    branchName: d.branchName || null,
    initiatedBy: d.initiatedBy || user.name,
    checkedBy: d.checkedBy || null,
  };
  const lineRows = d.lines.map((l, i) => ({
    description: l.description,
    qtyWords: l.qtyWords || null,
    uom: l.uom || null,
    unitPrice: l.unitPrice,
    amount: l.amount,
    sortOrder: i,
  }));

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (invoice.nopa) {
        await tx.nopaLine.deleteMany({ where: { nopaId: invoice.nopa.id } });
        await tx.nopa.update({
          where: { id: invoice.nopa.id },
          data: { ...nopaFields, lines: { create: lineRows } },
        });
      } else {
        await tx.nopa.create({
          data: { ...nopaFields, invoiceId: id, lines: { create: lineRows } },
        });
      }
      return tx.invoice.update({
        where: { id },
        data: {
          status: "PENDING_APPROVAL",
          submittedByName: user.name,
          submittedAt: new Date(),
          // A resubmit supersedes any earlier decision — clear it so stale
          // approver names can never appear on the printed approval note.
          decidedByName: null,
          decidedByRole: null,
          decidedAt: null,
          decisionRemarks: null,
        },
      });
    });
    return NextResponse.json({ ok: true, invoice: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "A NOPA with that number already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not submit for approval." }, { status: 500 });
  }
}
