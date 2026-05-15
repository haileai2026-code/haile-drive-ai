import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { MaterialsPanel } from "@/components/admin/MaterialsPanel";
import { ExamsListPanel } from "./admin.exams";

export const Route = createFileRoute("/admin/content")({
  head: () => ({ meta: [{ title: "תוכן לימודי — Haile Drive AI" }] }),
  component: ContentPage,
});

function ContentPage() {
  const [tab, setTab] = useState<"materials" | "exams">("materials");
  return (
    <AdminShell title="תוכן לימודי">
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab("materials")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === "materials" ? "bg-gold text-gold-foreground" : "border border-border/60 text-muted-foreground"}`}
        >
          📚 חומרי לימוד
        </button>
        <button
          onClick={() => setTab("exams")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === "exams" ? "bg-gold text-gold-foreground" : "border border-border/60 text-muted-foreground"}`}
        >
          📝 בנק מבחנים
        </button>
      </div>
      {tab === "materials" ? <MaterialsPanel /> : <ExamsListPanel />}
    </AdminShell>
  );
}
