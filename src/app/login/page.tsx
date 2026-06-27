import { redirect } from "next/navigation";
import { getCurrentUser, roleHome } from "@/lib/rbac";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.mustChangePassword ? "/account/password" : roleHome(user.role));
  return <LoginForm />;
}
