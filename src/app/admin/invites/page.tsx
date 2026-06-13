import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import Badge from "@/components/Badge";
import InviteForm from "@/components/InviteForm";

export const dynamic = "force-dynamic";

export default async function InvitesPage() {
  if (!(await isAdminAuthed())) return null;

  const invites = await prisma.vendorInvite.findMany({
    orderBy: { sentAt: "desc" },
    include: { vendor: { select: { id: true, companyName: true } } },
  });

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8">
        <h1 className="text-lg font-semibold text-slate-900">Invitations</h1>
        <span className="ml-3 text-sm text-slate-400">{invites.length} total</span>
      </header>

      <div className="p-8 space-y-5">
        <InviteForm />

        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {invites.length === 0 ? (
            <p className="text-sm text-slate-500 p-6">
              No invitations sent yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-100">
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Company hint</th>
                    <th className="py-3 px-4">Sent</th>
                    <th className="py-3 px-4">Expires</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Vendor</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((inv) => (
                    <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2.5 px-4">{inv.email}</td>
                      <td className="py-2.5 px-4 text-slate-500">{inv.companyHint || "—"}</td>
                      <td className="py-2.5 px-4 text-slate-500">{fmtDate(inv.sentAt)}</td>
                      <td className="py-2.5 px-4 text-slate-500">{fmtDate(inv.expiresAt) || "—"}</td>
                      <td className="py-2.5 px-4"><Badge value={inv.status} /></td>
                      <td className="py-2.5 px-4">
                        {inv.vendor ? (
                          <Link href={`/admin/vendors/${inv.vendor.id}`} className="text-brand hover:underline">
                            {inv.vendor.companyName}
                          </Link>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
