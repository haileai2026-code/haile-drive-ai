import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { InHouseRppgProvider } from "@/lib/diagnostics/inhouse-rppg";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/beqa-spike")({
  head: () => ({ meta: [{ title: "BEQA spike — דופק + לחיצה" }] }),
  component: BeqaSpikePage,
});

type ClickRow = {
  bpm: number | null;
  hrv: number | null;
  reaction_ms: number;
  at: string;
};

function BeqaSpikePage() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const rppgRef = useRef<InHouseRppgProvider | null>(null);
  const shownAt = useRef(performance.now());
  const sessionId = useRef(
    typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()),
  );
  const [bpm, setBpm] = useState<number | null>(null);
  const [hrv, setHrv] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [clicks, setClicks] = useState<ClickRow[]>([]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          await videoRef.current.play();
        }
        const rppg = new InHouseRppgProvider();
        rppg.onBPMSample = (b, h) => {
          setBpm(b);
          setHrv(h);
        };
        rppg.startMeasurement(stream);
        rppgRef.current = rppg;
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "camera failed");
      }
    })();
    return () => {
      rppgRef.current?.stopMeasurement();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const click = async () => {
    const row: ClickRow = {
      bpm,
      hrv,
      reaction_ms: Math.round(performance.now() - shownAt.current),
      at: new Date().toISOString(),
    };
    setClicks((c) => [...c, row]);
    if (user) {
      await supabase.from("beqa_pulse_clicks").insert({
        session_id: sessionId.current,
        student_id: user.id,
        bpm,
        hrv,
        signal_quality: bpm ? "medium" : "none",
        reaction_ms: row.reaction_ms,
        provider: "inhouse",
      });
    }
  };

  return (
    <AppShell requireAuth={false}>
      <div dir="rtl" className="mx-auto grid max-w-4xl gap-4 p-4 md:grid-cols-[260px_1fr]">
        <div className="rounded-2xl border border-gold/30 bg-card p-3">
          <video ref={videoRef} className="w-full scale-x-[-1] rounded-xl bg-black" playsInline muted />
          <div className="mt-2 text-4xl font-black text-gold">{bpm ?? "—"}</div>
          <p className="text-xs text-muted-foreground">HRV {hrv ?? "—"} · in-house on-device</p>
        </div>
        <div className="rounded-3xl border border-gold/30 bg-card p-6 text-center">
          <h1 className="text-xl font-bold">המצלמה מזהה דופק — לחץ</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            הווידאו לא נשמר. רק BPM / HRV / זמן תגובה.
          </p>
          {err && <p className="mt-2 text-sm text-rose-400">{err}</p>}
          <button
            type="button"
            disabled={bpm == null}
            onClick={click}
            className="mt-6 w-full max-w-xs rounded-2xl bg-gradient-to-br from-gold to-amber-600 px-6 py-4 text-lg font-semibold text-gold-foreground disabled:opacity-40"
          >
            לחץ
          </button>
          <ul className="mt-4 space-y-1 text-start text-sm">
            {clicks.map((c, i) => (
              <li key={c.at}>
                #{i + 1} BPM {c.bpm ?? "—"} · {c.reaction_ms} ms
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
