"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Segmented from "@/components/Segmented";

type Status = "" | "ALLOCATED" | "RETURNED";

/**
 * URL-driven status filter for the asset register (`?status=`). Preserves the
 * `?employeeId=` scope from Task 10 so the two filters compose — switching
 * status while deep-linked to one employee's kit must not drop the scope.
 */
export default function AssetStatusFilter({
  counts,
}: {
  counts: { all: number; ALLOCATED: number; RETURNED: number };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const urlStatus = (params.get("status") ?? "") as Status;
  const employeeId = params.get("employeeId");

  function push(next: Status) {
    const sp = new URLSearchParams();
    if (employeeId) sp.set("employeeId", employeeId);
    if (next) sp.set("status", next);
    const qs = sp.toString();
    router.push(qs ? `/hr/assets?${qs}` : "/hr/assets");
  }

  const options: { value: Status; label: string }[] = [
    { value: "", label: `All ${counts.all}` },
    { value: "ALLOCATED", label: `Allocated ${counts.ALLOCATED}` },
    { value: "RETURNED", label: `Returned ${counts.RETURNED}` },
  ];

  return (
    <Segmented
      ariaLabel="Filter assets by status"
      options={options}
      value={urlStatus}
      onChange={push}
      size="sm"
    />
  );
}
