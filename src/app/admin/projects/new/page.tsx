import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import { PageHeader, btn } from "@/components/ui";
import ProjectForm from "@/components/ProjectForm";
import WorkbookUpload from "@/components/WorkbookUpload";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  if (!(await isAdminAuthed())) return null;

  const approved = await prisma.vendor.findMany({
    where: { status: "APPROVED" },
    select: { id: true, companyName: true },
    orderBy: { companyName: "asc" },
  });

  // Fall back to all vendors if none are approved yet.
  const vendors =
    approved.length > 0
      ? approved
      : await prisma.vendor.findMany({
          select: { id: true, companyName: true },
          orderBy: { companyName: "asc" },
        });

  return (
    <>
      <PageHeader title="New project">
        <Link href="/admin/projects" className={btn("secondary", "sm")}>
          <ArrowLeft className="h-4 w-4" />
          Back to projects
        </Link>
      </PageHeader>

      <div className="p-8 space-y-6">
        <WorkbookUpload />
        <ProjectForm vendors={vendors} />
      </div>
    </>
  );
}
