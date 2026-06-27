import { requirePageRole, SUPERADMIN_ONLY } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { BrandHero } from "@/components/chrome";
import UserAdmin from "@/components/UserAdmin";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requirePageRole(SUPERADMIN_ONLY);
  const rows = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true, lastLoginAt: true },
  });
  const initialUsers = rows.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null }));
  return (
    <>
      <BrandHero variant="mint" size="sm" wave={false} eyebrow="Administration" title="Users" subtitle="Manage staff accounts and roles." className="px-6 pb-7 pt-9 sm:px-8" />
      <div className="p-6 sm:p-8"><UserAdmin initialUsers={initialUsers} meId={me.id} /></div>
    </>
  );
}
