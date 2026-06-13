import { prisma } from "@/lib/prisma";
import RegistrationForm from "@/components/RegistrationForm";

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="mt-3 text-slate-600">{body}</p>
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
        <header className="mb-6 flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-brand text-white grid place-items-center font-bold">
            GNE
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Vendor Registration Form
            </h1>
            <p className="text-sm text-slate-500">
              Fields marked <span className="text-rose-600">*</span> are required.
            </p>
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
