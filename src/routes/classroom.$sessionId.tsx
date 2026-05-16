import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getClassroomAccess } from "@/lib/live-classes.functions";
import { ArrowRight, Loader2 } from "lucide-react";

export const Route = createFileRoute("/classroom/$sessionId")({
  head: () => ({ meta: [{ title: "שיעור חי — Haile Drive AI" }] }),
  component: ClassroomPage,
});

function ClassroomPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const access = useServerFn(getClassroomAccess);
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; url: string; title: string }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    access({ data: { eventId: sessionId } })
      .then((res) => {
        if (alive) setState({ kind: "ready", url: res.url, title: res.title });
      })
      .catch((e: any) => {
        if (alive) setState({ kind: "error", message: e?.message ?? "שגיאה לא ידועה" });
      });
    return () => { alive = false; };
  }, [sessionId]);

  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-gold/30 bg-card/60 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gold">🚌 Haile Drive AI</div>
            <h1 className="truncate text-sm font-bold sm:text-base">
              {state.kind === "ready" ? state.title : "שיעור חי"}
            </h1>
          </div>
          <button
            onClick={() => navigate({ to: "/schedule" })}
            className="inline-flex items-center gap-1 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/20"
          >
            <ArrowRight className="h-3.5 w-3.5" /> צא מהשיעור
          </button>
        </div>
      </header>

      <main className="flex-1">
        {state.kind === "loading" && (
          <div className="grid h-[70vh] place-items-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> מתחבר לשיעור…
            </div>
          </div>
        )}
        {state.kind === "error" && (
          <div className="mx-auto mt-12 max-w-md rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
            <p className="text-sm font-semibold text-rose-300">לא ניתן להצטרף לשיעור</p>
            <p className="mt-2 text-xs text-rose-200/80">{state.message}</p>
            <Link to="/schedule" className="mt-4 inline-block rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-gold-foreground">
              חזור ללו"ז
            </Link>
          </div>
        )}
        {state.kind === "ready" && (
          <div className="mx-auto h-[calc(100vh-140px)] max-w-6xl p-2 sm:p-4">
            <iframe
              src={state.url}
              allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
              className="h-full w-full rounded-2xl border border-gold/30 bg-black"
              title="שיעור חי"
            />
          </div>
        )}
      </main>

      <footer className="border-t border-gold/20 px-4 py-2 text-center text-[10px] text-muted-foreground">
        Haile Drive AI · שיעור חי מאובטח
      </footer>
    </div>
  );
}
