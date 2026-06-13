import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import Badge from "@/components/Badge";
import InviteForm from "@/components/InviteForm";
import {
  Building2,
  Clock,
  CheckCircle,
  Mail,
  CalendarDays,
  ChevronRight,
  Inbox,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  Card,
  CardHeader,
  CardBody,
  EmptyState,
  Table,
  thCls,
  tdCls,
  theadRowCls,
  trCls,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Guard BEFORE any DB query: the layout shows the login screen, but Next still
  // executes this component, so we must not fetch data when unauthenticated.
  if (!(await isAdminAuthed())) return null;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [total, awaiting, approved, pendingInvites, thisMonth, recent] =
    await Promise.all([
      prisma.vendor.count(),
      prisma.vendor.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
      prisma.vendor.count({ where: { status: "APPROVED" } }),
      prisma.vendorInvite.count({ where: { status: "PENDING" } }),
      prisma.vendor.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.vendor.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { _count: { select: { projects: true, documents: true } } },
      }),
    ]);

  return (
    <>
      <PageHeader title="Dashboard" />

      <div className="p-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Link href="/admin/vendors" className="block">
            <StatCard
              label="Total vendors"
              value={total}
              tone="brand"
              icon={<Building2 className="h-[18px] w-[18px]" />}
            />
          </Link>
          <Link href="/admin/vendors?status=SUBMITTED" className="block">
            <StatCard
              label="Awaiting review"
              value={awaiting}
              tone="amber"
              icon={<Clock className="h-[18px] w-[18px]" />}
            />
          </Link>
          <Link href="/admin/vendors?status=APPROVED" className="block">
            <StatCard
              label="Approved"
              value={approved}
              tone="emerald"
              icon={<CheckCircle className="h-[18px] w-[18px]" />}
            />
          </Link>
          <Link href="/admin/invites" className="block">
            <StatCard
              label="Pending invites"
              value={pendingInvites}
              tone="blue"
              icon={<Mail className="h-[18px] w-[18px]" />}
            />
          </Link>
          <StatCard
            label="This month"
            value={thisMonth}
            tone="slate"
            icon={<CalendarDays className="h-[18px] w-[18px]" />}
          />
        </div>

        <InviteForm />

        <Card>
          <CardHeader
            title="Recent vendors"
            action={
              <Link
                href="/admin/vendors"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 transition-colors hover:text-brand"
              >
                View all
                <ChevronRight className="h-4 w-4" />
              </Link>
            }
          />
          {recent.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-6 w-6" />}
              title="No vendors yet"
              description="Invite a vendor above to get started — their submissions will appear here."
            />
          ) : (
            <CardBody className="pt-0">
              <Table>
                <thead>
                  <tr className={theadRowCls}>
                    <th className={thCls}>Company</th>
                    <th className={thCls}>Email</th>
                    <th className={thCls}>GST</th>
                    <th className={thCls}>Projects</th>
                    <th className={thCls}>Status</th>
                    <th className={thCls}>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((v) => (
                    <tr key={v.id} className={trCls}>
                      <td className={tdCls}>
                        <Link
                          href={`/admin/vendors/${v.id}`}
                          className="font-medium text-slate-900 transition-colors hover:text-brand-700"
                        >
                          {v.companyName}
                        </Link>
                      </td>
                      <td className={tdCls}>
                        <span className="text-slate-600">{v.email}</span>
                      </td>
                      <td className={tdCls}>
                        <span className="text-slate-600">{v.gstNo}</span>
                      </td>
                      <td className={tdCls}>
                        <span className="text-slate-500">{v._count.projects}</span>
                      </td>
                      <td className={tdCls}>
                        <Badge value={v.status} />
                      </td>
                      <td className={tdCls}>
                        <span className="text-slate-500">{fmtDate(v.createdAt)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardBody>
          )}
        </Card>
      </div>
    </>
  );
}
