import Link from "next/link";
import type { ProjectStatus } from "@prisma/client";
import { fmtDateOnly } from "@/lib/format";
import { Card, Chip, AvatarStack, ProgressBar } from "@/components/ui";
import { projectTimeline } from "@/lib/hr-projects";

type CardProject = {
  id: string;
  name: string;
  code: string;
  client: string | null;
  status: ProjectStatus;
  startDate: Date | null;
  endDate: Date | null;
  assignments: { employee: { name: string } }[];
};

function statusChipCls(status: string) {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700";
  if (status === "ON_HOLD") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-500";
}

export default function ProjectCard({ project }: { project: CardProject }) {
  const tl = projectTimeline(project.status, project.startDate, project.endDate);
  const names = project.assignments.map((a) => a.employee.name);
  const n = names.length;
  return (
    <Card className="lift flex flex-col p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="nums font-mono text-xs text-slate-500">{project.code}</span>
        <Chip className={statusChipCls(project.status)}>{project.status.replace(/_/g, " ")}</Chip>
      </div>
      <Link
        href={`/hr/projects/${project.id}`}
        className="mt-2 block truncate font-display text-base font-semibold text-slate-900 hover:text-brand-700"
      >
        {project.name}
      </Link>
      <p className="mt-0.5 truncate text-sm text-slate-500">{project.client ?? "—"}</p>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
          <span className="nums">
            {fmtDateOnly(project.startDate) ?? "—"} → {fmtDateOnly(project.endDate) ?? "—"}
          </span>
          <span className="font-medium text-slate-600">{tl.label}</span>
        </div>
        {tl.pct === null ? (
          <div className="h-2 rounded-full bg-slate-100" />
        ) : (
          <ProgressBar value={tl.pct} tone={tl.tone} />
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        {n > 0 ? (
          <AvatarStack names={names} max={5} size="sm" />
        ) : (
          <span className="text-xs text-slate-400">No team yet</span>
        )}
        <span className="nums text-xs font-medium text-slate-500">
          {n} {n === 1 ? "person" : "people"}
        </span>
      </div>
    </Card>
  );
}
