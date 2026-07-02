import { redirect } from "next/navigation";
import { getCurrentUser, HR_VIEW, HR_WRITE } from "@/lib/rbac";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "@/components/Toast";
import CommandPalette from "@/components/CommandPalette";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/account/password");
  // rbac.ts is server-only — compute the two booleans here and pass them down
  // rather than importing rbac into the client palette.
  const canSearch = HR_VIEW.includes(user.role);
  const canWrite = HR_WRITE.includes(user.role);
  return (
    <div className="flex min-h-dvh w-full bg-canvas">
      <Sidebar user={{ name: user.name, email: user.email, role: user.role }} />
      <main className="flex min-h-dvh flex-1 flex-col min-w-0 pt-14 md:pt-0">{children}</main>
      <Toaster />
      <CommandPalette canSearch={canSearch} canWrite={canWrite} />
    </div>
  );
}
