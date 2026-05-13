import { createFileRoute } from "@tanstack/react-router";
import { processPendingNotifications } from "@/lib/notifications.functions";

export const Route = createFileRoute("/api/public/hooks/notifications-tick")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await processPendingNotifications();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: e?.message ?? "error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST to process queue" }),
    },
  },
});
