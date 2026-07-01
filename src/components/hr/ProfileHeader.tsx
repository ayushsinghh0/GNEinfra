import { Avatar, Chip, StatusChip } from "@/components/ui";
import { fmtDateOnly } from "@/lib/format";

// Non-sticky identity band under the PageHeader — data-adjacent, so no brand
// atmosphere (gradients/glow/grain) here; that lives only in chrome.
export default function ProfileHeader({
  name,
  empId,
  designation,
  location,
  empCategory,
  payrollType,
  dateOfJoining,
  status,
}: {
  name: string;
  empId: string;
  designation: string;
  location: string | null;
  empCategory: string | null;
  payrollType: string | null;
  dateOfJoining: Date;
  status: string;
}) {
  return (
    <div className="border-b border-slate-200/70 bg-white px-6 py-5 sm:px-8">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display truncate text-base font-semibold text-slate-900">{name}</h2>
            <StatusChip status={status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-slate-500">
            <span className="nums font-mono text-slate-400">{empId}</span>
            <span className="text-slate-300">·</span>
            <span>{designation}</span>
            {location && <Chip>{location}</Chip>}
            {empCategory && <Chip>{empCategory}</Chip>}
            {payrollType && <Chip>{payrollType}</Chip>}
            <Chip className="nums">Joined {fmtDateOnly(dateOfJoining)}</Chip>
          </div>
        </div>
      </div>
    </div>
  );
}
