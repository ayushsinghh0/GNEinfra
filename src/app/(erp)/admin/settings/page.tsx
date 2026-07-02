import { requirePageRole, ADMIN_AREA } from "@/lib/rbac";
import TestEmail from "@/components/TestEmail";
import { BrandHero } from "@/components/chrome";
import { Card, CardHeader, CardBody, cn } from "@/components/ui";
import { Mail, Server, HardDrive, Globe, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

function StatusPill({ ok, okLabel = "Configured", badLabel = "Not set" }: { ok: boolean; okLabel?: string; badLabel?: string }) {
  return (
    <span
      className={cn(
        "ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        ok
          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
          : "bg-amber-50 text-amber-700 ring-amber-600/20"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-amber-500")} aria-hidden="true" />
      {ok ? okLabel : badLabel}
    </span>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-center sm:gap-3">
      <div className="w-44 shrink-0 text-[13px] font-medium text-slate-500">{label}</div>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="nums min-w-0 truncate font-mono text-sm text-slate-900">{value}</div>
        {ok !== undefined && <StatusPill ok={ok} />}
      </div>
    </div>
  );
}

function CardIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700">
      {children}
    </span>
  );
}

export default async function SettingsPage() {
  await requirePageRole(ADMIN_AREA);

  const smtpHost = process.env.SMTP_HOST || "(not set)";
  const mailFrom = process.env.MAIL_FROM || "(not set)";
  const notify = process.env.PROCUREMENT_NOTIFY_EMAIL || "(not set)";
  const baseUrl = process.env.APP_BASE_URL || "(not set)";
  const sessionOk = (process.env.SESSION_SECRET?.length ?? 0) >= 16;
  const storage = (process.env.STORAGE_DRIVER || "local") === "s3"
    ? `S3 (${process.env.S3_BUCKET || "bucket not set"})`
    : "Local disk (development)";
  const purgeDays = process.env.DOC_PURGE_DAYS || "7";
  const maxAgeDays = process.env.DOC_MAX_AGE_DAYS;
  const cronConfigured = !!process.env.CRON_SECRET;

  return (
    <>
      <BrandHero
        variant="mint"
        size="sm"
        wave={false}
        eyebrow="Administration"
        title="Settings"
        subtitle="Runtime configuration read from the environment — change it in .env, not here."
        className="px-6 pb-7 pt-9 sm:px-8"
      />

      <div className="p-6 sm:p-8">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <CardIcon>
                    <Server className="h-4 w-4" />
                  </CardIcon>
                  Email (SMTP)
                </span>
              }
              subtitle="Vendor invites and notifications are sent through this server."
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
                <p className="mb-4 mt-1 text-sm text-slate-500">
                  Confirm the configuration above works before going live.
                </p>
                <TestEmail />
              </div>
            </CardBody>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <CardIcon>
                      <HardDrive className="h-4 w-4" />
                    </CardIcon>
                    Document storage
                  </span>
                }
                subtitle="Where vendor KYC uploads live, and when they're purged."
              />
              <CardBody>
                <div>
                  <Row label="Storage backend" value={storage} />
                  <Row label="Purge after download" value={`${purgeDays} days from first download`} />
                  {maxAgeDays && <Row label="Maximum age" value={`${maxAgeDays} days from upload`} />}
                  <Row
                    label="Purge cron secret"
                    value={cronConfigured ? "••••••••" : "(not set)"}
                    ok={cronConfigured}
                  />
                </div>
                <p className="mt-4 text-xs leading-relaxed text-slate-400">
                  Uploaded files are stored compressed and deleted automatically once a
                  retention window elapses, keeping storage cost minimal. Schedule{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-600">
                    /api/cron/purge
                  </code>{" "}
                  to run hourly (see DEPLOY.md).
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <CardIcon>
                      <Globe className="h-4 w-4" />
                    </CardIcon>
                    Application
                  </span>
                }
                subtitle="Identity of this deployment."
              />
              <CardBody>
                <Row label="Public base URL" value={baseUrl} ok={baseUrl !== "(not set)"} />
                <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-3">
                  <div className="w-44 shrink-0 text-[13px] font-medium text-slate-500">Session signing</div>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex items-center gap-1.5 text-sm text-slate-900">
                      <ShieldCheck className={cn("h-4 w-4", sessionOk ? "text-emerald-500" : "text-amber-500")} />
                      {sessionOk ? "Secret set" : "Secret missing or too short"}
                    </div>
                    <StatusPill ok={sessionOk} badLabel="Login disabled" />
                  </div>
                </div>
                {!sessionOk && (
                  <p className="mt-2 text-xs leading-relaxed text-amber-600">
                    SESSION_SECRET must be at least 16 characters — sign-in is disabled until it is.
                  </p>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
