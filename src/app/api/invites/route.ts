import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { inviteSchema } from "@/lib/validation";
import { newInviteToken } from "@/lib/tokens";
import { sendMail, inviteEmail, requirePublicBaseUrl } from "@/lib/mailer";

// POST /api/invites  (admin only)
// Creates an invite and emails the vendor a unique registration link.
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { email, companyHint } = parsed.data;
  const token = newInviteToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

  let invite;
  try {
    // Revoke any earlier still-pending invites for this email so only one live
    // token exists per address.
    await prisma.vendorInvite.updateMany({
      where: { email, status: "PENDING" },
      data: { status: "REVOKED" },
    });
    invite = await prisma.vendorInvite.create({
      data: { email, companyHint, token, expiresAt },
    });
  } catch {
    return NextResponse.json({ error: "Could not create the invitation." }, { status: 500 });
  }

  // Refuse to email a link built on a non-public base URL. A localhost / bare-IP /
  // sslip.io link is a dead end for the vendor (and a heavy spam signal), so we keep
  // the invite row but skip the send and tell the admin to fix APP_BASE_URL + resend.
  let base: string;
  try {
    base = requirePublicBaseUrl();
  } catch (err) {
    console.error("[invites] refusing to email an invite link", err);
    return NextResponse.json(
      {
        ok: true,
        emailed: false,
        link: `${process.env.APP_BASE_URL || ""}/register/${token}`,
        warning:
          "Invite created, but APP_BASE_URL is not a public HTTPS domain — no email was sent. Set APP_BASE_URL to your real domain and resend.",
        invite: { id: invite.id, email: invite.email },
      },
      { status: 200 }
    );
  }
  const link = `${base}/register/${token}`;
  const tpl = inviteEmail(link, companyHint);

  try {
    await sendMail({
      to: email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      unsubscribe: `mailto:${process.env.MAIL_REPLY_TO || process.env.SMTP_USER || ""}?subject=unsubscribe`,
    });
  } catch (err) {
    // Log the raw SMTP error server-side; return only a generic message so we
    // don't leak transport/infrastructure details to the client.
    console.error("[invites] email send failed", err);
    return NextResponse.json(
      {
        ok: true,
        emailed: false,
        link,
        warning:
          "Invite created but the email could not be sent. Share the link manually.",
        invite: { id: invite.id, email: invite.email },
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: true,
    emailed: true,
    link,
    invite: { id: invite.id, email: invite.email },
  });
}
