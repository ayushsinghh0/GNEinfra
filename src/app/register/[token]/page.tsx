import { prisma } from "@/lib/prisma";
import RegistrationForm from "@/components/RegistrationForm";
import { AlertCircle, CheckCircle2 } from "lucide-react";

// This page decides whether to show the form or a "link already used / expired"
// notice based on live invite state. It MUST render dynamically on every request
// — otherwise Next.js could cache the form and keep serving it after the invite
// has been consumed, defeating the single-use link.
export const dynamic = "force-dynamic";
export const revalidate = 0;

function Notice({
  title,
  body,
  tone = "amber",
}: {
  title: string;
  body: string;
  tone?: "amber" | "emerald";
}) {
  const tones = {
    amber: { ring: "bg-amber-50 text-amber-600", icon: <AlertCircle className="h-6 w-6" /> },
    emerald: { ring: "bg-emerald-50 text-emerald-600", icon: <CheckCircle2 className="h-6 w-6" /> },
  }[tone];
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-10 text-center">
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-brand text-white text-sm font-bold tracking-tight shadow-sm">
          GNE
        </div>
        <div className={`mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl ${tones.ring}`}>
          {tones.icon}
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{body}</p>
        <p className="mt-6 text-xs text-slate-400">
          Please contact GNE procurement if you need a new link.
        </p>
      </div>
    </main>
  );
}

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await prisma.vendorInvite.findUnique({ where: { token } });

  if (!invite) {
    return <Notice title="Invalid link" body="This registration link is not valid." />;
  }
  if (invite.status === "USED") {
    return (
      <Notice
        tone="emerald"
        title="Already submitted"
        body="This registration link has already been used and can't be opened again. Your details are with our procurement team."
      />
    );
  }
  if (invite.status === "REVOKED") {
    return <Notice title="Link revoked" body="This registration link is no longer active." />;
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return <Notice title="Link expired" body="This registration link has expired." />;
  }

  // The form renders its own full-height two-column onboarding shell.
  return (
    <RegistrationForm
      token={token}
      defaultEmail={invite.email}
      defaultCompany={invite.companyHint ?? undefined}
    />
  );
}
