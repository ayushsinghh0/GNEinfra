import Link from "next/link";
import { Mail, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import Badge from "@/components/Badge";
import InviteForm from "@/components/InviteForm";
import {
  PageHeader,
  Card,
  Table,
  EmptyState,
  thCls,
  tdCls,
  theadRowCls,
  trCls,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InvitesPage() {
  if (!(await isAdminAuthed())) return null;

  const invites = await prisma.vendorInvite.findMany({
    orderBy: { sentAt: "desc" },
    include: { vendor: { select: { id: true, companyName: true } } },
  });

  return (
    <>
      <PageHeader title="Invitations" subtitle={`${invites.length} total`} />

      <div className="p-8 space-y-6">
        <InviteForm />

        <Card className="overflow-hidden">
          {invites.length === 0 ? (
            <EmptyState
              icon={<Mail className="h-6 w-6" />}
              title="No invitations sent yet"
              description="Invite a vendor above to send them a unique registration link."
            />
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr className={theadRowCls}>
                  <th className={thCls}>Email</th>
                  <th className={thCls}>Company hint</th>
                  <th className={thCls}>Sent</th>
                  <th className={thCls}>Expires</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Vendor</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.id} className={trCls}>
                    <td className={tdCls}>
                      <span className="font-medium text-slate-900">{inv.email}</span>
                    </td>
                    <td className={tdCls}>
                      {inv.companyHint || <span className="text-slate-400">—</span>}
                    </td>
                    <td className={tdCls}>
                      <span className="nums text-slate-500">{fmtDate(inv.sentAt)}</span>
                    </td>
                    <td className={tdCls}>
                      <span className="nums text-slate-500">{fmtDate(inv.expiresAt) || "—"}</span>
                    </td>
                    <td className={tdCls}>
                      <Badge
                        value={
                          inv.status === "PENDING" && inv.expiresAt && inv.expiresAt < new Date()
                            ? "EXPIRED"
                            : inv.status
                        }
                      />
                    </td>
                    <td className={tdCls}>
                      {inv.vendor ? (
                        <Link
                          href={`/admin/vendors/${inv.vendor.id}`}
                          className="inline-flex items-center gap-1 font-medium text-brand-700 transition-colors hover:text-brand"
                        >
                          {inv.vendor.companyName}
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
