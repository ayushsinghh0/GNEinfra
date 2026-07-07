import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, FINANCE_WRITE } from "@/lib/rbac";
import { tallySettingsSchema, zodErrorMessage } from "@/lib/finance-validation";

// Upserts the TallySettings singleton — the ledger names the Tally XML export
// posts to (read via getTallySettings()). Blank fields fall back to defaults.
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword || !FINANCE_WRITE.includes(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
  }
  const parsed = tallySettingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 });
  }
  const d = parsed.data;
  const data = {
    tallyCompanyName: d.tallyCompanyName?.trim() || null,
    salesLedger: d.salesLedger?.trim() || null,
    gstLedger: d.gstLedger?.trim() || null,
    bankLedger: d.bankLedger?.trim() || null,
    roundOffLedger: d.roundOffLedger?.trim() || null,
    updatedBy: user.name,
  };
  try {
    const settings = await prisma.tallySettings.upsert({
      where: { id: "tally" },
      create: { id: "tally", ...data },
      update: data,
    });
    return NextResponse.json({ ok: true, settings });
  } catch {
    return NextResponse.json({ error: "Could not save the Tally settings." }, { status: 500 });
  }
}
