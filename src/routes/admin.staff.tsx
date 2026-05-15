import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { Users } from "lucide-react";

export const Route = createFileRoute("/admin/staff")({
  head: () => ({ meta: [{ title: "Staff & Permissions — Haile Drive AI" }] }),
  component: StaffPage,
});

function StaffPage() {
  return (
    <AdminShell title="צוות והרשאות">
      <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
        <Users className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3">ניהול הצוות עבר לדפים החדשים.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link to="/admin/users" className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground">
            משתמשים
          </Link>
          <Link to="/admin/teachers" className="rounded-xl border border-border/60 px-4 py-2 text-sm">
            מורים
          </Link>
        </div>
      </div>
    </AdminShell>
  );
}
