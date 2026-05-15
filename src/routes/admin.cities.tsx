import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { CitiesPanel } from "@/components/admin/CitiesPanel";

export const Route = createFileRoute("/admin/cities")({
  head: () => ({ meta: [{ title: "ערים — Haile Drive AI" }] }),
  component: CitiesPage,
});

function CitiesPage() {
  return <AdminShell title="ערים, כיתות ותלמידים"><CitiesPanel /></AdminShell>;
}
