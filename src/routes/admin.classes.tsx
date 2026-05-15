import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { ClassesPanel } from "@/components/admin/ClassesPanel";

export const Route = createFileRoute("/admin/classes")({
  head: () => ({ meta: [{ title: "כיתות — Haile Drive AI" }] }),
  component: ClassesPage,
});

function ClassesPage() {
  return <AdminShell title="ניהול כיתות"><ClassesPanel /></AdminShell>;
}
