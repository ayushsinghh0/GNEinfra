import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_WRITE } from "@/lib/rbac";
import { PageHeader, Card, CardBody } from "@/components/ui";
import PolicyForm from "@/components/hr/PolicyForm";

export const dynamic = "force-dynamic";

export default async function EditPolicyPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole(HR_WRITE);
  const { id } = await params;

  const policy = await prisma.companyPolicy.findUnique({ where: { id } });
  if (!policy) notFound();

  const initial = {
    title: policy.title,
    category: policy.category ?? "",
    content: policy.content,
    effectiveFrom: policy.effectiveFrom ? policy.effectiveFrom.toISOString().slice(0, 10) : "",
    isActive: policy.isActive,
  };

  return (
    <>
      <PageHeader
        title="Edit policy"
        subtitle={policy.title}
        breadcrumbs={[{ label: "HR", href: "/hr" }, { label: "Policies", href: "/hr/policies" }, { label: "Edit" }]}
      />
      <div className="p-8">
        <Card>
          <CardBody>
            {/* key={id}: remount on policy-to-policy navigation so seeded state can't leak. */}
            <PolicyForm key={id} id={id} initial={initial} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
