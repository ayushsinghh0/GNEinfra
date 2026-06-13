import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { sendMail } from "@/lib/mailer";

// POST /api/admin/test-email { to } (admin only)
// Sends a test message through the configured SMTP so you can confirm email
// works (and "see" it land) before going live.
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { to } = await req.json().catch(() => ({ to: "" }));
  if (!to || typeof to !== "string") {
    return NextResponse.json({ error: "Recipient email required" }, { status: 400 });
  }

  try {
    const info = await sendMail({
      to,
      subject: "GNE ERP — SMTP test email",
      html: `<div style="font-family:Arial,sans-serif">
        <h2 style="color:#0f766e">SMTP is working ✓</h2>
        <p>This is a test email from your GNE ERP vendor portal. If you can read
        this, your email configuration is correct.</p>
        <p style="color:#64748b;font-size:13px">Host: ${process.env.SMTP_HOST} ·
        From: ${process.env.MAIL_FROM}</p>
      </div>`,
      text: "SMTP is working. This is a test email from your GNE ERP vendor portal.",
    });
    return NextResponse.json({ ok: true, messageId: (info as { messageId?: string }).messageId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send" },
      { status: 502 }
    );
  }
}
