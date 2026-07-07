import Link from "next/link";
import { notFound } from "next/navigation";
import { Users, Briefcase, UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import { fmtDateOnly } from "@/lib/format";
import {
  PageHeader, Card, CardBody, StatusChip, EntityLink,
  KeyValue, DetailSection, btn,
} from "@/components/ui";
import RecruitmentDelete from "@/components/hr/RecruitmentDelete";
import CandidateStageSelect from "@/components/hr/CandidateStageSelect";

export const dynamic = "force-dynamic";

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePageRole(HR_VIEW);
  const canWrite = HR_WRITE.includes(viewer.role);
  const { id } = await params;

  const c = await prisma.candidate.findUnique({
    where: { id },
    include: { position: { select: { id: true, title: true, code: true, band: true } } },
  });
  if (!c) notFound();

  // "Convert to employee" — prefill the new-employee form with the known fields.
  const convert = new URLSearchParams();
  convert.set("name", c.name);
  if (c.email) convert.set("mailId", c.email);
  if (c.position?.title) convert.set("designation", c.position.title);
  if (c.position?.band) convert.set("band", c.position.band);
  const convertHref = `/hr/employees/new?${convert.toString()}`;

  return (
    <>
      <PageHeader
        title={c.name}
        subtitle={c.email ?? c.phone ?? undefined}
        breadcrumbs={[
          { label: "HR", href: "/hr" },
          { label: "Recruitment", href: "/hr/recruitment" },
          { label: "Candidates", href: "/hr/recruitment/candidates" },
          { label: c.name },
        ]}
      >
        <StatusChip status={c.stage} />
        {canWrite && (
          <>
            <Link href={`/hr/recruitment/candidates/${id}/edit`} className={btn("secondary", "sm")}>Edit</Link>
            <RecruitmentDelete
              endpoint={`/api/hr/recruitment/candidates/${id}`}
              redirectTo="/hr/recruitment/candidates"
              label="candidate"
              message={`Delete "${c.name}"? This removes the candidate record permanently.`}
            />
          </>
        )}
      </PageHeader>

      <div className="space-y-6 p-8">
        {canWrite && (
          <Card>
            <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700">Pipeline stage</span>
                <CandidateStageSelect id={id} stage={c.stage} />
              </div>
              <Link href={convertHref} className={btn("primary", "sm")}>
                <UserPlus className="h-4 w-4" />
                Convert to employee
              </Link>
            </CardBody>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DetailSection title="Candidate details" icon={<Users className="h-4 w-4 text-slate-400" />}>
            <KeyValue
              items={[
                { label: "Email", value: c.email },
                { label: "Phone", value: c.phone },
                { label: "Source", value: c.source },
                { label: "Experience", value: c.experienceYears != null ? `${c.experienceYears} yr` : null },
                { label: "Notice period", value: c.noticePeriod },
                { label: "Applied on", value: fmtDateOnly(c.appliedOn) },
              ]}
            />
          </DetailSection>

          <DetailSection title="Position & CV" icon={<Briefcase className="h-4 w-4 text-slate-400" />}>
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-[13px] font-medium text-slate-500">Position</div>
                {c.position ? (
                  <EntityLink href={`/hr/recruitment/positions/${c.position.id}`} name={c.position.title} code={c.position.code ?? undefined} avatar={false} icon={<Briefcase className="h-4 w-4" />} />
                ) : (
                  <span className="text-sm text-slate-400">Unassigned</span>
                )}
              </div>
              <KeyValue items={[{ label: "CV received", value: c.cvReceived ? "Yes" : "No" }]} />
              <div>
                <div className="mb-1 text-[13px] font-medium text-slate-500">CV link</div>
                {c.cvLink ? (
                  <a href={c.cvLink} target="_blank" rel="noopener noreferrer" className="break-all text-sm font-medium text-brand-700 hover:text-brand">
                    {c.cvLink}
                  </a>
                ) : (
                  <span className="text-sm text-slate-400">—</span>
                )}
              </div>
            </div>
          </DetailSection>
        </div>

        {c.notes && (
          <DetailSection title="Notes">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{c.notes}</p>
          </DetailSection>
        )}
      </div>
    </>
  );
}
