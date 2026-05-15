import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { ClassesPanel } from "@/components/admin/ClassesPanel";
import { BranchesPanel } from "@/components/admin/BranchesPanel";
import { CitiesPanel } from "@/components/admin/CitiesPanel";

export const Route = createFileRoute("/admin/organization")({
  head: () => ({ meta: [{ title: "ארגון — Haile Drive AI" }] }),
  component: OrganizationPage,
});

type Tab = "classes" | "branches" | "cities" | "tracks";

const TABS: { id: Tab; label: string }[] = [
  { id: "classes", label: "🏫 כיתות" },
  { id: "branches", label: "👥 קבוצות" },
  { id: "cities", label: "🏙️ ערים" },
  { id: "tracks", label: "🛤️ מסלולים" },
];

function OrganizationPage() {
  const [tab, setTab] = useState<Tab>("classes");

  return (
    <AdminShell title="ניהול ארגוני">
      <div className="mb-4 flex flex-wrap gap-2 border-b border-border/60 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === t.id
                ? "bg-gold text-gold-foreground"
                : "border border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "classes" && <ClassesPanel />}
      {tab === "branches" && <BranchesPanel />}
      {tab === "cities" && <CitiesPanel />}
      {tab === "tracks" && (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
          ניהול מסלולים — בקרוב
        </div>
      )}
    </AdminShell>
  );
}
