import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Heart, Play, Square, Activity, Brain, Trophy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { RppgSimulator, type BiometricSample } from "@/lib/rppg-sdk";
import { STRESS_QUESTIONS, STRESS_TEST_CONFIG, calculateBeqaScore } from "@/lib/beqa-questions";
import { toast } from "sonner";

export const Route = createFileRoute("/diagnostics")({
  component: DiagnosticsPage,
});

const CALIBRATION_SECONDS = 30;

type Phase = "idle" | "calibrating" | "calibrated" | "running" | "done";

function DiagnosticsPage() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const sdkRef = useRef<RppgSimulator | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const calibSamples = useRef<number[]>([]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [currentBpm, setCurrentBpm] = useState<number | null>(null);
  const [currentHrv, setCurrentHrv] = useState<number | null>(null);
  const [calibProgress, setCalibProgress] = useState(0);
  const [baselineHr, setBaselineHr] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Stress test state
  const stressSamples = useRef<number[]>([]);
  const questionShownAt = useRef<number>(0);
  const [qIndex, setQIndex] = useState(0);
  const [qTimeLeft, setQTimeLeft] = useState(STRESS_TEST_CONFIG.timePerQuestionMs / 1000);
  const [answers, setAnswers] = useState<{ correct: boolean; rt: number }[]>([]);
  const [finalScore, setFinalScore] = useState<{
    accuracy: number;
    stability: number;
    beqa: number;
    avgRt: number;
    stressHr: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      sdkRef.current?.stop();
    };
  }, []);

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 320, height: 240 },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const sdk = new RppgSimulator();
      sdkRef.current = sdk;
      sdk.onSample((s: BiometricSample) => {
        setCurrentBpm(s.bpm);
        setCurrentHrv(s.hrv);
      });
      await sdk.start(stream);
      setCameraReady(true);
      toast.success("המצלמה פעילה — מוכן לכיול");
    } catch (e) {
      console.error(e);
      toast.error("גישה למצלמה נדחתה");
    }
  };

  const startCalibration = async () => {
    if (!user || !sdkRef.current) return;

    // Create a session row in Supabase
    const { data, error } = await supabase
      .from("beqa_diagnostic_sessions")
      .insert({ student_id: user.id, metadata: { phase: "calibration" } })
      .select("id")
      .single();
    if (error || !data) {
      toast.error("שגיאה ביצירת סשן");
      return;
    }
    sessionIdRef.current = data.id;
    calibSamples.current = [];
    setPhase("calibrating");
    sdkRef.current.setMode("rest");

    const sub = sdkRef.current.onSample(async (s) => {
      calibSamples.current.push(s.bpm);
      // Log raw event
      await supabase.from("raw_biometric_log").insert({
        session_id: sessionIdRef.current!,
        student_id: user.id,
        event_type: "calibration_tick",
        bpm: s.bpm,
        hrv: s.hrv,
      });
    });

    const startTs = Date.now();
    const interval = setInterval(async () => {
      const elapsed = (Date.now() - startTs) / 1000;
      const pct = Math.min(100, (elapsed / CALIBRATION_SECONDS) * 100);
      setCalibProgress(pct);
      if (elapsed >= CALIBRATION_SECONDS) {
        clearInterval(interval);
        sub();
        const avg =
          calibSamples.current.reduce((a, b) => a + b, 0) /
          Math.max(1, calibSamples.current.length);
        const baseline = Math.round(avg * 10) / 10;
        setBaselineHr(baseline);
        await supabase
          .from("beqa_diagnostic_sessions")
          .update({ baseline_hr: baseline })
          .eq("id", sessionIdRef.current!);
        setPhase("calibrated");
        toast.success(`כיול הסתיים — דופק מנוחה: ${baseline} BPM`);
      }
    }, 200);
  };

  const stopAll = () => {
    sdkRef.current?.stop();
    sdkRef.current = null;
    setCameraReady(false);
    setPhase("idle");
    setCurrentBpm(null);
    setCurrentHrv(null);
    setCalibProgress(0);
  };

  // ---- Stress test ----
  const startStressTest = () => {
    if (!sdkRef.current || !user || !sessionIdRef.current) return;
    sdkRef.current.setMode("stress");
    stressSamples.current = [];
    setAnswers([]);
    setQIndex(0);
    setPhase("running");

    // Capture stress BPM samples
    sdkRef.current.onSample(async (s) => {
      stressSamples.current.push(s.bpm);
      await supabase.from("raw_biometric_log").insert({
        session_id: sessionIdRef.current!,
        student_id: user.id,
        event_type: "bpm_sample",
        bpm: s.bpm,
        hrv: s.hrv,
      });
    });

    showQuestion(0);
  };

  const showQuestion = async (idx: number) => {
    if (!user || !sessionIdRef.current) return;
    questionShownAt.current = Date.now();
    setQIndex(idx);
    setQTimeLeft(STRESS_TEST_CONFIG.timePerQuestionMs / 1000);
    await supabase.from("raw_biometric_log").insert({
      session_id: sessionIdRef.current,
      student_id: user.id,
      event_type: "question_shown",
      bpm: currentBpm ?? null,
      hrv: currentHrv ?? null,
      payload: { question_id: STRESS_QUESTIONS[idx].id, index: idx },
    });
  };

  // Per-question countdown
  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => {
      setQTimeLeft((prev) => {
        if (prev <= 1) {
          // timeout — count as wrong
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
    const next = [...answers, { correct, rt }];
    setAnswers(next);

    await supabase.from("raw_biometric_log").insert({
      session_id: sessionIdRef.current,
      student_id: user.id,
      event_type: "answer_submitted",
      bpm: currentBpm ?? null,
      hrv: currentHrv ?? null,
      payload: {
        question_id: q.id,
        selected: selectedIdx,
        correct,
        timeout,
        reaction_time_ms: rt,
      },
    });

    if (qIndex + 1 < STRESS_QUESTIONS.length) {
      showQuestion(qIndex + 1);
    } else {
      await finishTest(next);
    }
  };

  const finishTest = async (allAnswers: { correct: boolean; rt: number }[]) => {
    if (!sessionIdRef.current || !baselineHr) return;
    const correctAnswers = allAnswers.filter((a) => a.correct).length;
    const stressHr = stressSamples.current.length
      ? Math.round(
          (stressSamples.current.reduce((a, b) => a + b, 0) /
            stressSamples.current.length) * 10,
        ) / 10
      : baselineHr;
    const avgRt = Math.round(
      allAnswers.reduce((a, b) => a + b.rt, 0) / Math.max(1, allAnswers.length),
    );
    const score = calculateBeqaScore({
      correctAnswers,
      totalQuestions: STRESS_QUESTIONS.length,
      baselineHr,
      stressHr,
    });

    await supabase
      .from("beqa_diagnostic_sessions")
      .update({
        end_time: new Date().toISOString(),
        stress_hr: stressHr,
        accuracy_score: score.accuracy,
        reaction_time_avg: avgRt,
        final_beqa_score: score.beqa,
        metadata: { phase: "complete", correct: correctAnswers, total: STRESS_QUESTIONS.length },
      })
      .eq("id", sessionIdRef.current);

    setFinalScore({ ...score, avgRt, stressHr });
    setPhase("done");
    sdkRef.current?.setMode("rest");
    toast.success(`ציון BEQA: ${score.beqa}%`);
  };

  return (
    <AppShell>
      <div className="space-y-4" dir="rtl">
        <div>
          <h1 className="text-2xl font-bold">אבחון ביומטרי BEQA</h1>
          <p className="text-sm text-muted-foreground">
            כיול דופק מנוחה דרך המצלמה (rPPG) — 30 שניות
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="h-4 w-4" /> תצוגת מצלמה
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative mx-auto aspect-[4/3] w-full max-w-xs overflow-hidden rounded-xl bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {!cameraReady && (
                <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                  המצלמה כבויה
                </div>
              )}
              {phase === "calibrating" && (
                <div className="absolute inset-0 ring-4 ring-gold/70 animate-pulse rounded-xl" />
              )}
            </div>

            {!cameraReady ? (
              <Button onClick={requestCamera} className="w-full">
                <Camera className="ml-2 h-4 w-4" /> אפשר גישה למצלמה
              </Button>
            ) : (
              <Button onClick={stopAll} variant="outline" className="w-full">
                <Square className="ml-2 h-4 w-4" /> כבה מצלמה
              </Button>
            )}
          </CardContent>
        </Card>

        {cameraReady && (
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Heart className="h-4 w-4 text-red-500" /> דופק (BPM)
                </div>
                <div className="mt-1 text-2xl font-bold">
                  {currentBpm ?? "—"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Activity className="h-4 w-4 text-emerald-500" /> HRV
                </div>
                <div className="mt-1 text-2xl font-bold">
                  {currentHrv ?? "—"}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {cameraReady && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">כיול ביומטרי (30 שניות)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {phase === "calibrating" && (
                <>
                  <Progress value={calibProgress} />
                  <p className="text-xs text-muted-foreground">
                    אנא שב/י בנינוחות ונשום/י רגיל… {Math.round(calibProgress)}%
                  </p>
                </>
              )}
              {baselineHr !== null && (
                <div className="rounded-lg bg-emerald-500/10 p-3 text-sm">
                  ✅ דופק מנוחה (Baseline): <strong>{baselineHr} BPM</strong>
                </div>
              )}
              {phase === "idle" || phase === "calibrated" ? (
                <Button
                  onClick={startCalibration}
                  className="w-full"
                  disabled={phase === "calibrated"}
                >
                  <Play className="ml-2 h-4 w-4" />
                  {phase === "calibrated" ? "כיול הושלם" : "התחל כיול ביומטרי"}
                </Button>
              ) : null}
              {phase === "calibrated" && (
                <Button onClick={startStressTest} variant="default" className="w-full">
                  <Brain className="ml-2 h-4 w-4" /> התחל מבחן תחת סטרס
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {phase === "running" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Brain className="h-4 w-4" /> שאלה {qIndex + 1}/{STRESS_QUESTIONS.length}
                </span>
                <span className="text-xs text-muted-foreground">⏱ {qTimeLeft}s</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress
                value={
                  (qTimeLeft / (STRESS_TEST_CONFIG.timePerQuestionMs / 1000)) * 100
                }
              />
              <p className="font-medium text-sm leading-relaxed">
                {STRESS_QUESTIONS[qIndex].text}
              </p>
              <div className="space-y-2">
                {STRESS_QUESTIONS[qIndex].options.map((opt, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="w-full justify-start text-right"
                    onClick={() => submitAnswer(i)}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {phase === "done" && finalScore && (
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
                <div className="text-[10px] text-muted-foreground mt-1">
                  (Accuracy × 0.6) + (Stability × 0.4)
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">דיוק</div>
                  <div className="font-bold">{finalScore.accuracy}%</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">יציבות</div>
                  <div className="font-bold">{finalScore.stability}%</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">דופק מנוחה</div>
                  <div className="font-bold">{baselineHr} BPM</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">דופק תחת סטרס</div>
                  <div className="font-bold">{finalScore.stressHr} BPM</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 col-span-2">
                  <div className="text-xs text-muted-foreground">זמן תגובה ממוצע</div>
                  <div className="font-bold">{finalScore.avgRt} ms</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
