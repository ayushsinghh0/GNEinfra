import { prisma } from "@/lib/prisma";
import Image from "next/image";
import { docLabel } from "@/lib/doc-labels";
import ReuploadForm from "@/components/ReuploadForm";
import { AlertCircle, CheckCircle2 } from "lucide-react";

// Must render dynamically so a consumed/expired token is never served from cache.
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
      <div className="max-w-lg w-full bg-white rounded-3xl shadow-[var(--shadow-pop)] p-10 text-center">
        <div className="mx-auto mb-3 flex h-11 items-center justify-center">
          <Image src="/brand/gne-infra.png" alt="GNE Infra" width={120} height={32} className="h-8 w-auto" priority />
        </div>
        <div className={`mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl ${tones.ring}`}>
          {tones.icon}
        </div>
        <h1 className="font-display text-xl font-extrabold tracking-[-0.02em] text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{body}</p>
        <p className="mt-6 text-xs text-slate-500">
          Please contact GNE procurement if you need a new link.
        </p>
      </div>
    </main>
  );
}

export default async function ReuploadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const reqRow = await prisma.documentRequest.findUnique({ where: { token } });

  if (!reqRow) {
    return <Notice title="Invalid link" body="This upload link is not valid." />;
  }
  if (reqRow.status === "USED") {
    return (
      <Notice
        tone="emerald"
        title="Already uploaded"
        body="This document has already been re-uploaded. Thank you — our procurement team has it."
      />
    );
  }
  if (reqRow.status === "REVOKED") {
    return <Notice title="Link no longer valid" body="A newer request has replaced this link." />;
  }
  if (reqRow.expiresAt && reqRow.expiresAt < new Date()) {
    return <Notice title="Link expired" body="This upload link has expired." />;
  }

  return <ReuploadForm token={token} docLabel={docLabel(reqRow.docType)} />;
}
