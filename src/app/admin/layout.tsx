import { isAdminAuthed } from "@/lib/auth";
import AdminLogin from "@/components/AdminLogin";
import Sidebar from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Single auth gate for the whole admin area. Not logged in → login screen.
  if (!(await isAdminAuthed())) {
    return <AdminLogin />;
  }

  return (
    <div className="flex min-h-screen w-full bg-canvas">
      <Sidebar />
      <main className="flex min-h-screen flex-1 flex-col min-w-0 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
