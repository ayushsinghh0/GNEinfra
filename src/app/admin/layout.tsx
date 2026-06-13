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
    <div className="flex flex-1 w-full">
      <Sidebar />
      <div className="flex-1 min-w-0 bg-slate-50">{children}</div>
    </div>
  );
}
