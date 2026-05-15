import { createFileRoute } from "@tanstack/react-router";
import { processPendingNotifications } from "@/lib/notifications.functions";

export const Route = createFileRoute("/api/public/hooks/notifications-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Require a shared secret so this endpoint can't be triggered by the public.
        const expected = process.env.CRON_SECRET;
        if (expected) {
          const got = request.headers.get("x-cron-secret");
          if (got !== expected) {
            return new Response("Unauthorized", { status: 401 });
          }
        }
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
      GET: async () => Response.json({ ok: true, hint: "POST with x-cron-secret to process queue" }),
    },
  },
});
