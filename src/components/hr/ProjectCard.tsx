import Link from "next/link";
import type { ProjectStatus } from "@prisma/client";
import { fmtDateOnly } from "@/lib/format";
import { Card, StatusChip, AvatarStack, ProgressBar } from "@/components/ui";
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

export default function ProjectCard({ project }: { project: CardProject }) {
  const tl = projectTimeline(project.status, project.startDate, project.endDate);
  const names = project.assignments.map((a) => a.employee.name);
  const n = names.length;
  return (
    <Card className="lift relative flex flex-col p-5">
      {/* Stretched-link: the whole card is the click target (code/client/timeline
          included), not just the title. Keyboard-focusable; per-item controls below
          (the avatar stack) opt back in with `relative z-10`. */}
      <Link
        href={`/hr/projects/${project.id}`}
        className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        aria-label={project.name}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="nums font-mono text-xs text-slate-500">{project.code}</span>
        <StatusChip status={project.status} />
      </div>
      <p className="mt-2 truncate font-display text-base font-semibold text-slate-900">
        {project.name}
      </p>
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
          <span className="relative z-10">
            <AvatarStack names={names} max={5} size="sm" />
          </span>
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
