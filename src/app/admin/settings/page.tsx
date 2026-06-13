import { isAdminAuthed } from "@/lib/auth";
import TestEmail from "@/components/TestEmail";
import { PageHeader, Card, CardHeader, CardBody, cn } from "@/components/ui";
import { Mail, Server, HardDrive } from "lucide-react";

export const dynamic = "force-dynamic";

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="w-44 shrink-0 text-sm font-medium text-slate-500">{label}</div>
      <div className="text-sm text-slate-900 font-mono truncate">{value}</div>
      {ok !== undefined && (
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset shrink-0",
            ok
              ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
              : "bg-amber-50 text-amber-700 ring-amber-600/20"
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-amber-500")} />
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
      <PageHeader title="Settings" />

      <div className="p-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <Server className="h-4 w-4" />
                </span>
                Email (SMTP)
              </span>
            }
            subtitle="Send a test email to confirm your SMTP settings work before going live."
          />
          <CardBody className="space-y-5">
            <div>
              <Row label="SMTP host" value={smtpHost} ok={smtpHost !== "(not set)"} />
              <Row label="From address" value={mailFrom} ok={mailFrom !== "(not set)"} />
              <Row label="Procurement inbox" value={notify} ok={notify !== "(not set)"} />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Mail className="h-4 w-4 text-brand-700" />
                Send a test email
              </h3>
              <p className="mt-1 mb-4 text-sm text-slate-500">
                We&apos;ll dispatch a message using the configuration above.
              </p>
              <TestEmail />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <HardDrive className="h-4 w-4" />
                </span>
                Document storage
              </span>
            }
          />
          <CardBody>
            <div>
              <Row label="Storage backend" value={storage} />
              <Row label="Auto-delete after" value={`${purgeDays} days from first download`} />
              <Row
                label="Purge cron secret"
                value={cronConfigured ? "••••••••" : "(not set)"}
                ok={cronConfigured}
              />
            </div>
            <p className="text-xs text-slate-400 mt-4 leading-relaxed">
              Uploaded files are stored compressed and automatically deleted{" "}
              {purgeDays} days after they are first downloaded, to keep cloud storage
              cost minimal. Schedule{" "}
              <code className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                /api/cron/purge
              </code>{" "}
              to run daily (see DEPLOY.md).
            </p>
          </CardBody>
        </Card>
        </div>
      </div>
    </>
  );
}
