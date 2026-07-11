import Link from "next/link";
import { BookOpenText, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { fmtDateOnly } from "@/lib/format";
import { PageHeader, Card, Chip, EmptyState, btn } from "@/components/ui";

export const dynamic = "force-dynamic";

// Company policy handbook: each policy is a collapsible <details> card (native,
// no JS) — the summary row carries title/category/effective date, expanding
// reveals the full text. Active policies first, newest first within each group.
export default async function PoliciesPage() {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);

  const policies = await prisma.companyPolicy.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
  const activeCount = policies.filter((p) => p.isActive).length;

  return (
    <>
      <PageHeader
        title="Company Policies"
        subtitle={`${activeCount} active${policies.length > activeCount ? ` · ${policies.length - activeCount} archived` : ""}`}
        breadcrumbs={[{ label: "HR", href: "/hr" }, { label: "Policies" }]}
      >
        {canWrite && (
          <Link href="/hr/policies/new" className={btn("primary", "sm")}>
            + Add policy
          </Link>
        )}
      </PageHeader>

      <div className="space-y-4 p-8">
        {policies.length === 0 ? (
          <Card className="overflow-hidden">
            <EmptyState
              icon={<BookOpenText className="h-6 w-6" />}
              title="No policies yet"
              description="Publish company policies here — leave rules, code of conduct, IT usage, travel and more."
              action={
                canWrite ? (
                  <Link href="/hr/policies/new" className={btn("primary", "sm")}>
                    + Add the first policy
                  </Link>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <ul className="space-y-3">
            {policies.map((p) => (
              <li key={p.id}>
                <Card className={p.isActive ? undefined : "opacity-70"}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 px-6 py-4 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0 flex-1 text-[15px] font-semibold tracking-tight text-slate-900">
                        {p.title}
                      </span>
                      {p.category && <Chip>{p.category}</Chip>}
                      {!p.isActive && <Chip className="bg-slate-200 text-slate-500">Archived</Chip>}
                      {p.effectiveFrom && (
                        <span className="nums shrink-0 text-xs text-slate-500">
                          Effective {fmtDateOnly(p.effectiveFrom)}
                        </span>
                      )}
                      <span className="shrink-0 text-xs font-medium text-brand-700 group-open:hidden">Read</span>
                      <span className="hidden shrink-0 text-xs font-medium text-slate-400 group-open:inline">Collapse</span>
                    </summary>
                    <div className="border-t border-slate-100 px-6 py-5">
                      <p className="max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{p.content}</p>
                      <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
                        <span className="nums">Last updated {fmtDateOnly(p.updatedAt)}</span>
                        {canWrite && (
                          <Link
                            href={`/hr/policies/${p.id}/edit`}
                            className="press inline-flex items-center gap-1 font-medium text-brand-700 transition-colors hover:text-brand"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Link>
                        )}
                      </div>
                    </div>
                  </details>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
