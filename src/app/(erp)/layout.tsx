import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "@/components/Toast";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/account/password");
  return (
    <div className="flex min-h-dvh w-full bg-canvas">
      <Sidebar user={{ name: user.name, email: user.email, role: user.role }} />
      <main className="flex min-h-dvh flex-1 flex-col min-w-0 overflow-x-hidden pt-14 md:pt-0">{children}</main>
      <Toaster />
    </div>
  );
}
