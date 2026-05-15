import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Camera, Heart, Play, Square, Activity, Brain, Trophy, Wifi, Target,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { RppgEngine, type SignalQuality } from "@/lib/rppg-engine";
import {
  STRESS_QUESTIONS, STRESS_TEST_CONFIG, calculateBeqaScore, type BeqaBreakdown,
} from "@/lib/beqa-questions";
import { toast } from "sonner";

export const Route = createFileRoute("/diagnostics")({
  component: DiagnosticsPage,
});

const CALIBRATION_SECONDS = 30;

type Phase = "welcome" | "idle" | "calibrating" | "calibrated" | "running" | "done";

type AnswerRow = {
  qId: string;
  correct: boolean;
  rt: number;
  bpmAtShow: number | null;
  bpmAtAnswer: number | null;
  attentionHit?: boolean;
  attentionRt?: number;
};

type BioDiagnostics = {
  fps: number;
  meanGreen: number | null;
  brightness: number | null;
  skinRatio: number;
  motion: number | null;
  samplesInWindow: number;
};

const QUALITY_LABEL: Record<SignalQuality, string> = {
  none: "אין סיגנל", low: "נמוך", medium: "בינוני", high: "גבוה",
};
const QUALITY_COLOR: Record<SignalQuality, string> = {
  none: "bg-gray-500", low: "bg-red-500", medium: "bg-amber-500", high: "bg-emerald-500",
};

function DiagnosticsPage() {
  const { user } = useAuth();
  const [beqaAccess, setBeqaAccess] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user) { setBeqaAccess(null); return; }
    (async () => {
      const { data } = await supabase
        .from("candidates")
        .select("beqa_access")
        .or(`id.eq.${user.id},email.eq.${user.email ?? ""}`)
        .maybeSingle();
      setBeqaAccess(!!data?.beqa_access);
    })();
  }, [user]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<RppgEngine | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const calibBpms = useRef<number[]>([]);
  const stressPulseUnsubRef = useRef<(() => void) | null>(null);

  const [phase, setPhase] = useState<Phase>("welcome");
  const [bpm, setBpm] = useState<number | null>(null);
  const [hrv, setHrv] = useState<number | null>(null);
  const [quality, setQuality] = useState<SignalQuality>("none");
  const [faceDetected, setFaceDetected] = useState(false);
  const [calibProgress, setCalibProgress] = useState(0);
  const [calibSeconds, setCalibSeconds] = useState(CALIBRATION_SECONDS);
  const [baselineHr, setBaselineHr] = useState<number | null>(null);
  const [baselineHrv, setBaselineHrv] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [bioDiagnostics, setBioDiagnostics] = useState<BioDiagnostics>({
    fps: 0, meanGreen: null, brightness: null, skinRatio: 0, motion: null, samplesInWindow: 0,
  });

  // Stress test state
  const stressBpms = useRef<number[]>([]);
  const questionShownAt = useRef<number>(0);
  const questionShownBpm = useRef<number | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [qTimeLeft, setQTimeLeft] = useState(STRESS_TEST_CONFIG.timePerQuestionMs / 1000);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [finalScore, setFinalScore] = useState<(BeqaBreakdown & { avgRt: number; stressHr: number }) | null>(null);

  // Attention probe (catch trial)
  const [probeActive, setProbeActive] = useState(false);
  const probeShownAt = useRef<number>(0);
  const probeHandled = useRef<boolean>(false);
  const probeStats = useRef<{ hits: number; misses: number; rts: number[] }>({
    hits: 0, misses: 0, rts: [],
  });

  useEffect(() => () => { engineRef.current?.stop(); }, []);

  const requestCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("הדפדפן לא תומך במצלמה. נסה Chrome/Safari עדכני.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480, frameRate: { ideal: 30 } },
        audio: false,
      });
      // mount the <video> element first, then attach the stream
      setPhase("idle");
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      // wait up to ~1s for ref to mount
      for (let i = 0; i < 30 && !videoRef.current; i++) {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
      }
      if (!videoRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        toast.error("לא ניתן לאתחל את תצוגת הוידאו");
        return;
      }
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      try {
        await videoRef.current.play();
      } catch (playErr) {
        console.warn("video.play() failed, will retry on user gesture", playErr);
      }
      const engine = new RppgEngine();
      engineRef.current = engine;
      engine.onSample((snap) => {
        setBpm(snap.bpm);
        setHrv(snap.hrv);
        setQuality(snap.signalQuality);
        setFaceDetected(snap.faceDetected);
        setBioDiagnostics({
          fps: snap.fps, meanGreen: snap.meanGreen, brightness: snap.brightness,
          skinRatio: snap.skinRatio, motion: snap.motion, samplesInWindow: snap.samplesInWindow,
        });
      });
      await engine.start(stream, videoRef.current!);
      setCameraReady(true);
      setPhase("idle");
      toast.success("המצלמה פעילה — מתחיל ניתוח rPPG");
    } catch (e: any) {
      console.error("camera error:", e);
      const name = e?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        toast.error("גישה למצלמה נחסמה. אפשר אותה בהגדרות הדפדפן.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        toast.error("לא נמצאה מצלמה במכשיר");
      } else if (name === "NotReadableError") {
        toast.error("המצלמה בשימוש על ידי אפליקציה אחרת");
      } else {
        toast.error(`שגיאת מצלמה: ${e?.message || name || "לא ידוע"}`);
      }
      setPhase("welcome");
    }
  };

  const startCalibration = async () => {
    if (!user || !engineRef.current) return;
    const { data, error } = await supabase
      .from("beqa_diagnostic_sessions")
      .insert({ student_id: user.id, metadata: { phase: "calibration", engine: "rppg-real-v1" } })
      .select("id").single();
    if (error || !data) { toast.error("שגיאה ביצירת סשן"); return; }
    sessionIdRef.current = data.id;
    calibBpms.current = [];
    setPhase("calibrating");

    const offPulse = engineRef.current.onPulse(async (pulse) => {
      calibBpms.current.push(pulse.bpm);
      await supabase.from("raw_biometric_log").insert({
        session_id: sessionIdRef.current!, student_id: user.id,
        event_type: "pulse_detected", bpm: pulse.bpm, hrv: pulse.hrv,
        payload: { phase: "calibration", rr_ms: pulse.rrIntervalMs, signal_quality: pulse.signalQuality },
      });
    });

    const startTs = Date.now();
    const interval = setInterval(async () => {
      const elapsed = (Date.now() - startTs) / 1000;
      setCalibProgress(Math.min(100, (elapsed / CALIBRATION_SECONDS) * 100));
      setCalibSeconds(Math.max(0, Math.ceil(CALIBRATION_SECONDS - elapsed)));
      if (elapsed >= CALIBRATION_SECONDS) {
        clearInterval(interval);
        offPulse();
        if (calibBpms.current.length < 5) {
          toast.error("לא הצלחנו לזהות מספיק פעימות. נסה שוב בתאורה טובה יותר.");
          setPhase("idle"); setCalibProgress(0); return;
        }
        const avg = calibBpms.current.reduce((a, b) => a + b, 0) / calibBpms.current.length;
        const baseline = Math.round(avg);
        const baselineHrvVal = engineRef.current?.getSnapshot().hrv ?? null;
        setBaselineHr(baseline);
        setBaselineHrv(baselineHrvVal);
        await supabase.from("beqa_diagnostic_sessions").update({
          baseline_hr: baseline,
          metadata: {
            phase: "calibrated", engine: "rppg-real-v1",
            baseline_hrv: baselineHrvVal, pulses_captured: calibBpms.current.length,
          },
        }).eq("id", sessionIdRef.current!);
        setPhase("calibrated");
        toast.success(`כיול הסתיים — דופק מנוחה: ${baseline} BPM`);
      }
    }, 200);
  };

  const stopAll = () => {
    stressPulseUnsubRef.current?.(); stressPulseUnsubRef.current = null;
    engineRef.current?.stop(); engineRef.current = null;
    sessionIdRef.current = null;
    calibBpms.current = []; stressBpms.current = [];
    probeStats.current = { hits: 0, misses: 0, rts: [] };
    setCameraReady(false); setPhase("welcome");
    setBpm(null); setHrv(null); setQuality("none"); setFaceDetected(false);
    setCalibProgress(0); setCalibSeconds(CALIBRATION_SECONDS);
    setBaselineHr(null); setBaselineHrv(null);
    setAnswers([]); setFinalScore(null); setProbeActive(false);
    setBioDiagnostics({ fps: 0, meanGreen: null, brightness: null, skinRatio: 0, motion: null, samplesInWindow: 0 });
  };

  // ---- Stress test ----
  const startStressTest = () => {
    if (!engineRef.current || !user || !sessionIdRef.current) return;
    if (quality !== "high") { toast.error("איכות סיגנל לא מספקת. המתן לסיגנל גבוה."); return; }
    stressBpms.current = [];
    probeStats.current = { hits: 0, misses: 0, rts: [] };
    setAnswers([]); setQIndex(0); setPhase("running");

    const offStressPulse = engineRef.current.onPulse(async (pulse) => {
      stressBpms.current.push(pulse.bpm);
      await supabase.from("raw_biometric_log").insert({
        session_id: sessionIdRef.current!, student_id: user.id,
        event_type: "pulse_detected", bpm: pulse.bpm, hrv: pulse.hrv,
        payload: { phase: "stress", rr_ms: pulse.rrIntervalMs, signal_quality: pulse.signalQuality },
      });
    });
    stressPulseUnsubRef.current = offStressPulse;

    showQuestion(0);
  };

  const showQuestion = async (idx: number) => {
    if (!user || !sessionIdRef.current) return;
    questionShownAt.current = Date.now();
    questionShownBpm.current = bpm;
    setQIndex(idx);
    setQTimeLeft(STRESS_TEST_CONFIG.timePerQuestionMs / 1000);

    await supabase.from("raw_biometric_log").insert({
      session_id: sessionIdRef.current, student_id: user.id,
      event_type: "question_shown", bpm, hrv,
      payload: { question_id: STRESS_QUESTIONS[idx].id, index: idx },
    });

    // Schedule attention probe every N questions, mid-question
    if ((idx + 1) % STRESS_TEST_CONFIG.attentionProbeEveryNQuestions === 0) {
      const delay = 4000 + Math.random() * 6000;
      setTimeout(() => {
        if (sessionIdRef.current) triggerAttentionProbe();
      }, delay);
    }
  };

  const triggerAttentionProbe = async () => {
    if (!user || !sessionIdRef.current) return;
    setProbeActive(true);
    probeShownAt.current = Date.now();
    probeHandled.current = false;
    await supabase.from("raw_biometric_log").insert({
      session_id: sessionIdRef.current, student_id: user.id,
      event_type: "attention_probe", bpm, hrv,
      payload: { question_id: STRESS_QUESTIONS[qIndex].id },
    });
    setTimeout(async () => {
      if (!probeHandled.current) {
        probeHandled.current = true;
        probeStats.current.misses++;
        setProbeActive(false);
        await supabase.from("raw_biometric_log").insert({
          session_id: sessionIdRef.current!, student_id: user.id,
          event_type: "attention_miss", bpm, hrv,
          payload: { question_id: STRESS_QUESTIONS[qIndex].id },
        });
      }
    }, STRESS_TEST_CONFIG.attentionProbeWindowMs);
  };

  const handleProbeClick = async () => {
    if (!probeActive || probeHandled.current || !user || !sessionIdRef.current) return;
    probeHandled.current = true;
    const rt = Date.now() - probeShownAt.current;
    probeStats.current.hits++;
    probeStats.current.rts.push(rt);
    setProbeActive(false);
    await supabase.from("raw_biometric_log").insert({
      session_id: sessionIdRef.current, student_id: user.id,
      event_type: "attention_hit", bpm, hrv,
      payload: { question_id: STRESS_QUESTIONS[qIndex].id, reaction_time_ms: rt },
    });
  };

  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => {
      setQTimeLeft((prev) => {
        if (prev <= 1) {
          submitAnswer(-1, true);
          return STRESS_TEST_CONFIG.timePerQuestionMs / 1000;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, qIndex]);

  const submitAnswer = async (selectedIdx: number, timeout = false) => {
    if (!user || !sessionIdRef.current) return;
    const q = STRESS_QUESTIONS[qIndex];
    const rt = Date.now() - questionShownAt.current;
    const correct = !timeout && selectedIdx === q.correctIndex;
    const row: AnswerRow = {
      qId: q.id, correct, rt, bpmAtShow: questionShownBpm.current, bpmAtAnswer: bpm,
    };
    const next = [...answers, row];
    setAnswers(next);

    await supabase.from("raw_biometric_log").insert({
      session_id: sessionIdRef.current, student_id: user.id,
      event_type: "answer_submitted", bpm, hrv,
      payload: {
        question_id: q.id, selected: selectedIdx, correct, timeout,
        reaction_time_ms: rt, bpm_at_show: questionShownBpm.current, bpm_at_answer: bpm,
      },
    });

    if (qIndex + 1 < STRESS_QUESTIONS.length) showQuestion(qIndex + 1);
    else await finishTest(next);
  };

  const finishTest = async (allAnswers: AnswerRow[]) => {
    if (!sessionIdRef.current || !baselineHr) return;
    stressPulseUnsubRef.current?.(); stressPulseUnsubRef.current = null;
    const correctAnswers = allAnswers.filter((a) => a.correct).length;
    const stressHr = stressBpms.current.length
      ? Math.round(stressBpms.current.reduce((a, b) => a + b, 0) / stressBpms.current.length)
      : baselineHr;
    const reactionTimesMs = allAnswers.map((a) => a.rt);
    const avgRt = Math.round(reactionTimesMs.reduce((a, b) => a + b, 0) / Math.max(1, reactionTimesMs.length));

    const score = calculateBeqaScore({
      correctAnswers, totalQuestions: STRESS_QUESTIONS.length,
      baselineHr, stressHr, reactionTimesMs,
    });

    await supabase.from("beqa_diagnostic_sessions").update({
      end_time: new Date().toISOString(), stress_hr: stressHr,
      accuracy_score: score.accuracy, reaction_time_avg: avgRt,
      final_beqa_score: score.beqa,
      metadata: {
        phase: "complete", engine: "rppg-real-v1",
        correct: correctAnswers, total: STRESS_QUESTIONS.length,
        baseline_hrv: baselineHrv, stress_pulses_captured: stressBpms.current.length,
        stability: score.stability, reaction_consistency: score.reaction,
        reaction_sd_ms: score.reactionSdMs, interpretation: score.interpretation,
        attention_hits: probeStats.current.hits,
        attention_misses: probeStats.current.misses,
        attention_avg_rt: probeStats.current.rts.length
          ? Math.round(probeStats.current.rts.reduce((a, b) => a + b, 0) / probeStats.current.rts.length)
          : null,
        per_question: allAnswers,
      },
    }).eq("id", sessionIdRef.current);

    setFinalScore({ ...score, avgRt, stressHr });
    setPhase("done");
    toast.success(`ציון BEQA: ${score.beqa}% — ${score.interpretation}`);
  };

  // Timeline data for results chart
  const timelineData = answers.map((a, i) => ({
    name: `Q${i + 1}`,
    BPM: a.bpmAtAnswer ?? a.bpmAtShow ?? 0,
    "RT (ms)": a.rt,
  }));

  if (user && beqaAccess === false) {
    return (
      <AppShell requireAuth={false}>
        <div dir="rtl" className="mx-auto max-w-md py-12 text-center space-y-4">
          <div className="text-5xl">🧬</div>
          <h1 className="text-2xl font-bold">אבחון BEQA נעול</h1>
          <p className="text-base text-muted-foreground">
            האבחון הביומטרי זמין בתשלום של 1,200 ₪. לרכישה — פנה להנהלה או שלח הודעה דרך פורטל הקהילה.
          </p>
          <p className="text-sm text-muted-foreground" lang="am">
            የ BEQA ምርመራ ዋጋ 1,200 ₪ ነው። ለመግዛት — አስተዳደሩን ያነጋግሩ።
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Link to="/community" search={{ tab: "contact" } as any}>
              <Button className="w-full">📩 פנה להנהלה</Button>
            </Link>
            <Link to="/dashboard"><Button variant="outline" className="w-full">חזרה</Button></Link>
          </div>
        </div>
      </AppShell>
    );
  }


  return (
    <AppShell requireAuth={false}>
      <div className="space-y-4" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">אבחון ביומטרי BEQA</h1>
            <p className="text-sm text-muted-foreground">
              מדידת דיוק, יציבות פיזיולוגית ועקביות תגובה תחת סטרס
            </p>
          </div>
          <Link to="/beqa-history">
            <Button size="sm" variant="outline">היסטוריה</Button>
          </Link>
        </div>

        {phase === "welcome" && (
          <Card className="border-emerald-500/40">
            <CardHeader>
              <CardTitle className="text-base">ברוך הבא לסימולציית Haile AI</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                הסימולציה מודדת ביצועים קוגניטיביים ודופק (rPPG מהמצלמה).
                אנא הישאר ממוקד והבטח שפניך מוארים וברורים למצלמה.
              </p>
              <ul className="list-disc pr-5 text-xs text-muted-foreground space-y-1">
                <li>מרחק 40–80 ס״מ מהמצלמה</li>
                <li>תאורה אחידה מלפנים, לא מאחור</li>
                <li>שב יציב ואל תזוז במהלך השאלות</li>
                <li>10 שאלות · 20 שניות לכל שאלה · משימות קשב מפתיעות</li>
              </ul>
              <Button onClick={requestCamera} className="w-full">
                <Camera className="ml-2 h-4 w-4" /> התחל סימולציה
              </Button>
            </CardContent>
          </Card>
        )}

        {phase !== "welcome" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera className="h-4 w-4" /> תצוגת מצלמה
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative mx-auto aspect-[4/3] w-full max-w-xs overflow-hidden rounded-xl bg-black">
                <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
                {cameraReady && (
                  <div
                    className="pointer-events-none absolute border-2 border-emerald-400/70 rounded"
                    style={{ width: "25%", height: "25%", left: "37.5%", top: "17.5%" }}
                  />
                )}
                {cameraReady && (
                  <div className="absolute top-2 right-2">
                    <Badge className={`${faceDetected ? "bg-emerald-500" : "bg-red-500"} text-white text-[10px]`}>
                      {faceDetected ? "● Face lock" : "○ אין נעילת פנים"}
                    </Badge>
                  </div>
                )}
                {cameraReady && !faceDetected && (
                  <div className="absolute inset-x-0 bottom-0 bg-amber-500/90 text-white text-xs p-2 text-center">
                    מחפש פנים… נא להישאר יציב מול המצלמה
                  </div>
                )}
                {cameraReady && faceDetected && (bioDiagnostics.brightness ?? 100) < 60 && (
                  <div className="absolute inset-x-0 bottom-0 bg-red-500/90 text-white text-xs p-2 text-center">
                    תאורה חלשה — הוסף אור מלפנים
                  </div>
                )}
              </div>

              {cameraReady && (
                <Button onClick={stopAll} variant="outline" className="w-full">
                  <Square className="ml-2 h-4 w-4" /> סיים והתחל מחדש
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {cameraReady && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Card><CardContent className="p-3">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Heart className="h-3 w-3 text-red-500" /> BPM</div>
                <div className="mt-1 text-xl font-bold">{bpm ?? "—"}</div>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Activity className="h-3 w-3 text-emerald-500" /> HRV</div>
                <div className="mt-1 text-xl font-bold">{hrv ?? "—"}</div>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Wifi className="h-3 w-3" /> איכות</div>
                <Badge className={`mt-1 ${QUALITY_COLOR[quality]} text-white text-[10px]`}>
                  {QUALITY_LABEL[quality]}
                </Badge>
              </CardContent></Card>
            </div>
            <Card>
              <CardContent className="grid grid-cols-3 gap-2 p-3 text-[10px] text-muted-foreground">
                <div><span className="block text-foreground">{bioDiagnostics.fps}</span> FPS</div>
                <div><span className="block text-foreground">{bioDiagnostics.samplesInWindow}</span> דגימות</div>
                <div><span className="block text-foreground">{Math.round(bioDiagnostics.skinRatio * 100)}%</span> ROI עור</div>
                <div><span className="block text-foreground">{bioDiagnostics.meanGreen?.toFixed(1) ?? "—"}</span> Green</div>
                <div><span className="block text-foreground">{bioDiagnostics.brightness?.toFixed(1) ?? "—"}</span> תאורה</div>
                <div><span className="block text-foreground">{bioDiagnostics.motion?.toFixed(2) ?? "—"}</span> תנועה</div>
              </CardContent>
            </Card>
          </>
        )}

        {cameraReady && (phase === "idle" || phase === "calibrating" || phase === "calibrated") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">כיול ביומטרי (30 שניות)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {phase === "calibrating" && (
                <>
                  <Progress value={calibProgress} />
                  <p className="text-xs text-muted-foreground">
                    {faceDetected ? "נעילה הושלמה — אוסף Baseline" : "מחפש פנים…"} · נותרו {calibSeconds}s · פעימות: {calibBpms.current.length}
                  </p>
                </>
              )}
              {baselineHr !== null && (
                <div className="rounded-lg bg-emerald-500/10 p-3 text-sm space-y-1">
                  <div>✅ דופק מנוחה: <strong>{baselineHr} BPM</strong></div>
                  {baselineHrv !== null && (
                    <div className="text-xs text-muted-foreground">HRV (RMSSD): {baselineHrv} ms</div>
                  )}
                </div>
              )}
              {phase === "idle" && (
                <Button onClick={startCalibration} className="w-full" disabled={!faceDetected}>
                  <Play className="ml-2 h-4 w-4" />
                  {faceDetected ? "התחל כיול ביומטרי" : "ממתין לזיהוי פנים…"}
                </Button>
              )}
              {phase === "calibrated" && (
                <Button onClick={startStressTest} className="w-full" disabled={quality !== "high"}>
                  <Brain className="ml-2 h-4 w-4" />
                  {quality === "high" ? "התחל מבחן תחת סטרס" : `ממתין לסיגנל גבוה (כעת: ${QUALITY_LABEL[quality]})`}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {phase === "running" && (
          <Card className="relative overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Brain className="h-4 w-4" /> שאלה {qIndex + 1}/{STRESS_QUESTIONS.length}
                </span>
                <span className="text-xs text-muted-foreground">
                  ⏱ {qTimeLeft}s · ❤ {bpm ?? "—"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={(qTimeLeft / (STRESS_TEST_CONFIG.timePerQuestionMs / 1000)) * 100} />
              <p className="font-medium text-sm leading-relaxed">{STRESS_QUESTIONS[qIndex].text}</p>
              <div className="space-y-2">
                {STRESS_QUESTIONS[qIndex].options.map((opt, i) => (
                  <Button key={i} variant="outline" className="w-full justify-start text-right" onClick={() => submitAnswer(i)}>
                    {opt}
                  </Button>
                ))}
              </div>
            </CardContent>
            {probeActive && (
              <button
                onClick={handleProbeClick}
                className="absolute top-2 left-2 grid h-14 w-14 place-items-center rounded-full bg-amber-400 text-amber-950 shadow-lg animate-pulse"
                aria-label="לחץ מיד"
              >
                <Target className="h-7 w-7" />
              </button>
            )}
          </Card>
        )}

        {phase === "done" && finalScore && (
          <>
            <Card className="border-2 border-emerald-500/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4 text-emerald-500" /> תוצאות BEQA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/10 p-4 text-center">
                  <div className="text-xs text-muted-foreground">ציון BEQA סופי</div>
                  <div className="text-4xl font-bold">{finalScore.beqa}%</div>
                  <div className="mt-1 text-sm font-medium">{finalScore.interpretation}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    (Acc × 0.4) + (Stress × 0.3) + (Reaction × 0.3)
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="text-xs text-muted-foreground">דיוק</div>
                    <div className="font-bold">{finalScore.accuracy}%</div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="text-xs text-muted-foreground">יציבות</div>
                    <div className="font-bold">{finalScore.stability}%</div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="text-xs text-muted-foreground">עקביות</div>
                    <div className="font-bold">{finalScore.reaction}%</div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="text-xs text-muted-foreground">דופק מנוחה</div>
                    <div className="font-bold">{baselineHr} BPM</div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="text-xs text-muted-foreground">דופק סטרס</div>
                    <div className="font-bold">{finalScore.stressHr} BPM</div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="text-xs text-muted-foreground">RT ממוצע</div>
                    <div className="font-bold">{finalScore.avgRt} ms</div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 col-span-3">
                    <div className="text-xs text-muted-foreground">
                      קשב (Catch trials) — פגיעות: {probeStats.current.hits} · החמצות: {probeStats.current.misses}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">ציר זמן: BPM וזמן תגובה</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis yAxisId="left" fontSize={10} />
                    <YAxis yAxisId="right" orientation="right" fontSize={10} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="BPM" stroke="#ef4444" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="RT (ms)" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
