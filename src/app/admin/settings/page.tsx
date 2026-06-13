import { isAdminAuthed } from "@/lib/auth";
import TestEmail from "@/components/TestEmail";

export const dynamic = "force-dynamic";

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
      <div className="w-44 shrink-0 text-sm text-slate-500">{label}</div>
      <div className="text-sm text-slate-900 font-mono">{value}</div>
      {ok !== undefined && (
        <span className={`ml-auto text-xs ${ok ? "text-emerald-600" : "text-amber-600"}`}>
          {ok ? "configured" : "not set"}
        </span>
      )}
    </div>
  );
}

export default async function SettingsPage() {
  if (!(await isAdminAuthed())) return null;

  const smtpHost = process.env.SMTP_HOST || "(not set)";
  const mailFrom = process.env.MAIL_FROM || "(not set)";
  const notify = process.env.PROCUREMENT_NOTIFY_EMAIL || "(not set)";
  const storage = (process.env.STORAGE_DRIVER || "local") === "s3"
    ? `S3 (${process.env.S3_BUCKET || "bucket not set"})`
    : "Local disk (development)";
  const purgeDays = process.env.DOC_PURGE_DAYS || "7";
  const cronConfigured = !!process.env.CRON_SECRET;

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8">
        <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
      </header>

      <div className="p-8 space-y-6 max-w-3xl">
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Email (SMTP)</h2>
          <p className="text-sm text-slate-500 mb-4">
            Send a test email to confirm your SMTP settings work before going live.
          </p>
          <div className="mb-5">
            <Row label="SMTP host" value={smtpHost} ok={smtpHost !== "(not set)"} />
            <Row label="From address" value={mailFrom} ok={mailFrom !== "(not set)"} />
            <Row label="Procurement inbox" value={notify} ok={notify !== "(not set)"} />
          </div>
          <TestEmail />
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Document storage</h2>
          <Row label="Storage backend" value={storage} />
          <Row label="Auto-delete after" value={`${purgeDays} days from first download`} />
          <Row label="Purge cron secret" value={cronConfigured ? "••••••••" : "(not set)"} ok={cronConfigured} />
          <p className="text-xs text-slate-400 mt-4">
            Uploaded files are stored compressed and automatically deleted{" "}
            {purgeDays} days after they are first downloaded, to keep cloud storage
            cost minimal. Schedule <code className="bg-slate-100 px-1 rounded">/api/cron/purge</code>{" "}
            to run daily (see DEPLOY.md).
          </p>
        </section>
      </div>
    </>
  );
}
