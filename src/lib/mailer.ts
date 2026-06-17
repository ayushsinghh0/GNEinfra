import nodemailer from "nodemailer";

// SMTP transport built from environment variables. In development this points
// at Mailpit (localhost:1025); in production at a real provider. See .env.example.
function createTransport() {
  const host = process.env.SMTP_HOST || "localhost";
  const port = Number(process.env.SMTP_PORT || 1025);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";

  return nodemailer.createTransport({
    host,
    port,
    secure,
    // Only attach auth when credentials are supplied (Mailpit needs none).
    auth: user ? { user, pass } : undefined,
    // Never let a slow/unreachable mail server hang a request.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

export async function sendMail({ to, subject, html, text }: SendArgs) {
  const transport = createTransport();
  const from = process.env.MAIL_FROM || "GNE Procurement <no-reply@gne.local>";
  return transport.sendMail({ from, to, subject, html, text });
}

// ── Email templates ───────────────────────────────────────────────────────

// Escape untrusted values before embedding them in HTML email bodies.
function esc(v: string) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BRAND = "#0f766e"; // teal — GNE accent

function wrap(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
    <div style="max-width:560px;margin:0 auto;padding:24px">
      <div style="background:${BRAND};color:#fff;padding:18px 24px;border-radius:10px 10px 0 0;font-size:18px;font-weight:bold">GNE — ${title}</div>
      <div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none;line-height:1.6">${body}</div>
      <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:16px">This is an automated message from the GNE ERP vendor portal.</p>
    </div></body></html>`;
}

export function inviteEmail(link: string, company?: string) {
  const hello = company ? `Dear ${esc(company)} team,` : "Hello,";
  return {
    subject: "Invitation to register as a GNE vendor",
    html: wrap(
      "Vendor Registration",
      `<p>${hello}</p>
       <p>You have been invited to register as a vendor/supplier with GNE. Please complete the registration form using the secure link below:</p>
       <p style="text-align:center;margin:28px 0">
         <a href="${link}" style="background:${BRAND};color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold">Open Registration Form</a>
       </p>
       <p style="font-size:13px;color:#475569">Or paste this link into your browser:<br><span style="word-break:break-all">${link}</span></p>
       <p>Please keep your GST and PAN details, your contact mobile number, and a cancelled cheque copy ready.</p>
       <p style="font-size:13px;color:#94a3b8">This link is valid for 30 days and can be used once — it stops working after you submit the form.</p>`
    ),
    text: `You have been invited to register as a GNE vendor. Open this link to complete the form: ${link} (valid 30 days, single use).`,
  };
}

export function vendorConfirmationEmail(company: string) {
  return {
    subject: "We've received your GNE vendor registration",
    html: wrap(
      "Registration Received",
      `<p>Dear ${esc(company)} team,</p>
       <p>Thank you — we have received your vendor registration. Our procurement team will review your details and get in touch if anything further is required.</p>
       <p>Regards,<br>GNE Procurement</p>`
    ),
    text: `Dear ${company} team, we have received your vendor registration. Our procurement team will review it. — GNE Procurement`,
  };
}

export function adminNotificationEmail(opts: {
  company: string;
  email: string;
  gstNo: string;
  panNo: string;
  adminLink: string;
}) {
  return {
    subject: `New vendor registration: ${opts.company}`,
    html: wrap(
      "New Vendor Submitted",
      `<p>A new vendor has submitted the registration form.</p>
       <table style="border-collapse:collapse;font-size:14px">
         <tr><td style="padding:4px 12px 4px 0;color:#64748b">Company</td><td><b>${esc(opts.company)}</b></td></tr>
         <tr><td style="padding:4px 12px 4px 0;color:#64748b">Email</td><td>${esc(opts.email)}</td></tr>
         <tr><td style="padding:4px 12px 4px 0;color:#64748b">GST</td><td>${esc(opts.gstNo)}</td></tr>
         <tr><td style="padding:4px 12px 4px 0;color:#64748b">PAN</td><td>${esc(opts.panNo)}</td></tr>
       </table>
       <p style="margin-top:20px"><a href="${opts.adminLink}" style="color:${BRAND}">Review in the admin panel →</a></p>`
    ),
    text: `New vendor submitted: ${opts.company} (${opts.email}). GST ${opts.gstNo}, PAN ${opts.panNo}. Review: ${opts.adminLink}`,
  };
}
