import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Laptop } from "lucide-react";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";
import { fmtDateOnly } from "@/lib/format";
import { DetailSection, KeyValue, Chip, EmptyState, btn } from "@/components/ui";
import { getEmployee } from "../_data";

export const dynamic = "force-dynamic";

// See (hub)/page.tsx's generateMetadata comment — same per-tab title fix.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const emp = await getEmployee(id);
  return { title: emp ? `${emp.name} · Assets` : "Employee" };
}

export default async function EmployeeAssetsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageRole(HR_VIEW);
  const { id } = await params;

  const emp = await getEmployee(id);
  if (!emp) notFound();

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link className={btn("secondary", "sm")} href={`/hr/assets?employeeId=${id}`}>
          Manage in asset register →
        </Link>
      </div>

      {emp.assets.length === 0 ? (
        <DetailSection title="Assets">
          <EmptyState
            icon={<Laptop className="h-5 w-5" />}
            title="No assets assigned"
            description="No assets have been recorded for this employee."
          />
        </DetailSection>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {emp.assets.map((a) => {
            const issued = [
              a.hasLaptop && "Laptop",
              a.laptopBag && "Bag",
              a.mouse && "Mouse",
              a.charger && "Charger",
              a.idCard && "ID Card",
            ].filter((x): x is string => Boolean(x));

            return (
              <DetailSection key={a.id} title={a.makeModel || (a.hasLaptop ? "Laptop" : "Asset")}>
                <div className="space-y-4">
                  {issued.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {issued.map((it) => (
                        <Chip key={it}>{it}</Chip>
                      ))}
                    </div>
                  )}
                  <KeyValue
                    items={[
                      { label: "Serial No", value: a.lpSerialNo, mono: true },
                      { label: "Make / Model", value: a.makeModel },
                      { label: "Category", value: a.lpCategory },
                      { label: "OEM", value: a.oemName },
                      { label: "Allocated", value: fmtDateOnly(a.allocatedAt) },
                      { label: "Returned", value: fmtDateOnly(a.returnedAt) },
                    ]}
                  />
                </div>
              </DetailSection>
            );
          })}
        </div>
      )}
    </div>
  );
}
