import { createFileRoute } from "@tanstack/react-router";
import { runPendingNotifications } from "@/lib/notifications.functions";

export const Route = createFileRoute("/api/public/hooks/notifications-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Require a shared secret so this endpoint can't be triggered by the public.
        const expected = process.env.CRON_SECRET;
        if (!expected) {
          return new Response("CRON_SECRET not configured", { status: 503 });
        }
        const got = request.headers.get("x-cron-secret");
        if (got !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const result = await runPendingNotifications();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: e?.message ?? "error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      GET: async () => new Response("Method Not Allowed", { status: 405 }),
    },
  },
});
