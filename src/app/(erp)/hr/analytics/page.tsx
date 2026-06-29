import { redirect } from "next/navigation";
import { requirePageRole, HR_VIEW } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// Analytics was merged into the HR dashboard (/hr). Keep this route as a redirect
// so existing links/bookmarks still land on the combined page.
export default async function HrAnalyticsRedirect() {
  await requirePageRole(HR_VIEW);
  redirect("/hr");
}
