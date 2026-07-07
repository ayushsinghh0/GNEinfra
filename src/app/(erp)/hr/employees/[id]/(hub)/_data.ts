import { cache } from "react";
import { prisma } from "@/lib/prisma";

// Request-scoped memoized loader — layout.tsx and page.tsx (and, in Task 13,
// the tab pages) all call this; React's `cache()` dedupes it to one query
// per request instead of once per component that needs the employee.
export const getEmployee = cache((id: string) =>
  prisma.employee.findUnique({
    where: { id },
    include: {
      assets: true,
      projectAssignments: { include: { project: true }, orderBy: { startDate: "desc" } },
    },
  })
);

export type EmployeeWithRelations = NonNullable<Awaited<ReturnType<typeof getEmployee>>>;
