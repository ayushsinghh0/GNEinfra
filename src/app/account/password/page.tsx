import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import PasswordChangeForm from "@/components/PasswordChangeForm";

export const dynamic = "force-dynamic";

export default async function AccountPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <PasswordChangeForm forced={user.mustChangePassword} />
    </main>
  );
}
