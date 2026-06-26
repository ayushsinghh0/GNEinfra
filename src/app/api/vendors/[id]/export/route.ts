import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { buildVendorWorkbook } from "@/lib/vendor-excel";

export const dynamic = "force-dynamic";

// GET /api/vendors/<id>/export  (admin only) → downloads the vendor record as .xlsx.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      services: { orderBy: { id: "asc" } },
      documents: { orderBy: { uploadedAt: "asc" } },
      products: { orderBy: { id: "asc" } },
      experiences: { orderBy: { id: "asc" } },
      purchaseOrders: { orderBy: { id: "asc" } },
      turnovers: { orderBy: { id: "asc" } },
    },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const buf = await buildVendorWorkbook(vendor);
  const safe =
    (vendor.vendorCode || vendor.companyName || "vendor")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .slice(0, 60) || "vendor";

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safe}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
