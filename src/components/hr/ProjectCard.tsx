import Link from "next/link";
import type { ProjectStatus } from "@prisma/client";
import { fmtDateOnly } from "@/lib/format";
import { Card, StatusChip, Avatar, ProgressBar } from "@/components/ui";
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
  const shown = names.slice(0, 5);
  const extra = n - shown.length;
  const hasFullTimeline = tl.pct !== null && project.startDate && project.endDate;

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
      <p className="mt-0.5 truncate text-sm text-slate-500">
        <span className="text-slate-400">Client</span> · {project.client ?? "No client"}
      </p>

      <div className="mt-4">
        {hasFullTimeline ? (
          <>
            <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
              <span className="nums">
                {fmtDateOnly(project.startDate)} → {fmtDateOnly(project.endDate)}
              </span>
              <span className="font-medium text-slate-600">{tl.label}</span>
            </div>
            <ProgressBar value={tl.pct as number} tone={tl.tone} />
          </>
        ) : project.startDate ? (
          <p className="nums text-xs text-slate-400">Started {fmtDateOnly(project.startDate)}</p>
        ) : project.endDate ? (
          <p className="nums text-xs text-slate-400">Ends {fmtDateOnly(project.endDate)}</p>
        ) : (
          <p className="text-xs text-slate-400">Dates not set</p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        {n > 0 ? (
          <div className="relative z-10 flex items-center -space-x-2">
            {shown.map((name, i) => (
              // Explicit descending z-index (not DOM paint order) so the FIRST avatar
              // stacks on top and stays fully visible — later avatars tuck behind it.
              <span key={`${name}-${i}`} className="relative" style={{ zIndex: shown.length - i }}>
                <Avatar name={name} size="sm" className="ring-2 ring-white" />
              </span>
            ))}
            {extra > 0 && (
              <span
                className="relative inline-grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500 ring-2 ring-white"
                style={{ zIndex: 0 }}
              >
                +{extra}
              </span>
            )}
          </div>
        ) : (
          <span />
        )}
        {n > 0 ? (
          <span className="nums text-xs font-medium text-slate-500">
            {n} {n === 1 ? "person" : "people"}
          </span>
        ) : (
          <span className="text-xs font-medium text-amber-600">No team yet</span>
        )}
      </div>
    </Card>
  );
}
