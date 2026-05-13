import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { notifications } from "@/lib/ops-data";
import { Bell, Megaphone, AlertTriangle, FileWarning, Calendar } from "lucide-react";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Haile Drive AI" }] }),
  component: NotificationsPage,
});

const ICON = { lesson: Bell, makeup: Calendar, docs: FileWarning, attendance: AlertTriangle, announcement: Megaphone };

function NotificationsPage() {
  return (
    <AdminShell title="Notification Center">
      <div className="rounded-2xl border border-border/60 bg-card/40">
        <ul className="divide-y divide-border/40">
          {notifications.map((n) => {
            const Icon = ICON[n.kind];
            return (
              <li key={n.id} className={`flex gap-3 p-4 ${!n.read ? "bg-gold/5" : ""}`}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-background/60 text-gold">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold">{n.title}</div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{n.at}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                </div>
                {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold" />}
              </li>
            );
          })}
        </ul>
      </div>
    </AdminShell>
  );
}
