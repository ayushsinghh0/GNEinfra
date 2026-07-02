import Link from "next/link";
import { SearchX } from "lucide-react";
import { Card, EmptyState, btn } from "@/components/ui";

/* In-shell 404 — rendered INSIDE the authenticated (erp) layout (sidebar stays),
   so a staff member who follows a stale link (e.g. a record that was deleted)
   lands on a helpful dead-end instead of Next's black default. Kept generic:
   this boundary serves every department, so it points at the sidebar rather
   than assuming a role-specific home. */
export default function ErpNotFound() {
  return (
    <div className="p-6 sm:p-8">
      <Card className="overflow-hidden">
        <EmptyState
          icon={<SearchX className="h-6 w-6" />}
          title="Record not found"
          description="This page or record doesn't exist — it may have been deleted, or the link is out of date. Use the sidebar to get back to your workspace."
          action={
            <Link href="/" className={btn("secondary", "sm")}>
              Go to home
            </Link>
          }
        />
      </Card>
    </div>
  );
}
