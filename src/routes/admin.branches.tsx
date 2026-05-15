import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { BranchesPanel } from "@/components/admin/BranchesPanel";

export const Route = createFileRoute("/admin/branches")({
  head: () => ({ meta: [{ title: "Branches — Haile Drive AI" }] }),
  component: BranchesPage,
});

function BranchesPage() {
  return <AdminShell title="Branches"><BranchesPanel /></AdminShell>;
}
