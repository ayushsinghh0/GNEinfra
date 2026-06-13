import { prisma } from "@/lib/prisma";
import RegistrationForm from "@/components/RegistrationForm";
import { AlertCircle, ShieldCheck } from "lucide-react";

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-10 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-600">
          <AlertCircle className="h-6 w-6" />
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
        title="Already submitted"
        body="This registration link has already been used. Your details are with our procurement team."
      />
    );
  }
  if (invite.status === "REVOKED") {
    return <Notice title="Link revoked" body="This registration link is no longer active." />;
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return <Notice title="Link expired" body="This registration link has expired." />;
  }

  return (
    <main className="flex-1 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand text-white font-bold tracking-tight shadow-sm">
              GNE
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Vendor Registration
              </h1>
              <p className="text-sm text-slate-500">
                GNE Solar EPC &middot; Supplier onboarding
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-brand" />
              Your information is shared only with GNE procurement.
            </span>
            <span className="text-slate-400">
              Fields marked <span className="text-rose-500">*</span> are required.
            </span>
          </div>
        </header>
        <RegistrationForm
          token={token}
          defaultEmail={invite.email}
          defaultCompany={invite.companyHint ?? undefined}
        />
      </div>
    </main>
  );
}
