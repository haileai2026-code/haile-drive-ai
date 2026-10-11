import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { submitPsychDiagnostic } from "@/lib/diagnostics/beqa-submit.functions";
import { questionsForCommunity, type Community, type Q } from "@/lib/diagnostics/psych-questions";

export const Route = createFileRoute("/psych-diagnostic")({
  head: () => ({ meta: [{ title: "אבחון פסיכולוגי-תעסוקתי — Haile Drive AI" }] }),
  component: PsychDiagnosticPage,
});

const COMMUNITY_LABEL: Record<Community, string> = {
  ethiopian: "🇪🇹 אמהרית",
  russian: "🇷🇺 רוסית",
  manashe: "✡️ קוקי (בני מנשה)",
};

function PsychDiagnosticPage() {
  const { user } = useAuth();
  const [community, setCommunity] = useState<Community | null>(null);
  const [step, setStep] = useState(0);
  // question id -> chosen option index (graded on the server, never here)
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const submitFn = useServerFn(submitPsychDiagnostic);

  const questions: Q[] = useMemo(() => {
    if (!community) return [];
    return questionsForCommunity(community);
  }, [community]);

  const total = questions.length;
  const current = questions[step];
  const progress = total ? Math.round(((step) / total) * 100) : 0;

  const pickAnswer = async (optionIndex: number) => {
    if (!current) return;
    const nextPicks = { ...picks, [current.id]: optionIndex };
    setPicks(nextPicks);
    if (step + 1 < total) {
      setStep(step + 1);
    } else {
      await finish(nextPicks);
    }
  };

  const finish = async (final: Record<string, number>) => {
    if (!user || !community) {
      toast.error("צריך להיות מחובר כדי לשמור תוצאה");
      return;
    }
    setSaving(true);
    try {
      // Server grades and stores the session; no score is returned to the client.
      await submitFn({ data: { community, picks: final } });
      toast.success("האבחון נשמר");
      setDone(true);
    } catch (e) {
      console.error(e);
      toast.error("שמירה נכשלה: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setCommunity(null); setStep(0); setPicks({}); setDone(false);
  };

  // ---- Renders ----
  if (!user) {
    return (
      <AppShell requireAuth={false}>
        <div dir="rtl" className="mx-auto max-w-md py-12 text-center space-y-4">
          <div className="text-5xl">🧠</div>
          <h1 className="text-2xl font-bold">אבחון פסיכולוגי-תעסוקתי</h1>
          <p className="text-sm text-muted-foreground">יש להתחבר כדי לבצע ולשמור את האבחון.</p>
          <Link to="/login"><Button>התחבר</Button></Link>
        </div>
      </AppShell>
    );
  }

  if (done) {
    // Completion only: students never see BEQA scores or recommendations (plan C3).
    return (
      <AppShell requireAuth={false}>
        <div dir="rtl" className="mx-auto max-w-md py-12 text-center space-y-6">
          <div className="text-6xl">✅</div>
          <div>
            <div className="text-2xl font-bold">האבחון הושלם</div>
            <p className="mt-2 text-base text-muted-foreground">התשובות נשמרו. הצוות יעבור עליהן ויחזור אליך.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={reset} variant="outline">בצע אבחון נוסף</Button>
            <Link to="/dashboard"><Button className="w-full">חזרה לדשבורד</Button></Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!community) {
    return (
      <AppShell requireAuth={false}>
        <div dir="rtl" className="mx-auto max-w-md py-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="text-5xl">🧠</div>
            <h1 className="text-2xl font-bold">אבחון פסיכולוגי-תעסוקתי</h1>
            <p className="text-sm text-muted-foreground">לפני שמתחילים — בחר את הקהילה שלך:</p>
          </div>
          <div className="grid gap-3">
            {(Object.keys(COMMUNITY_LABEL) as Community[]).map((c) => (
              <Button
                key={c}
                onClick={() => setCommunity(c)}
                size="lg"
                variant="outline"
                className="h-20 text-xl font-bold hover:bg-primary/10 hover:border-primary"
              >
                {COMMUNITY_LABEL[c]}
              </Button>
            ))}
          </div>
          <p className="text-xs text-center text-muted-foreground">
            14 שאלות · ~5 דקות · התוצאה נשמרת בפרופיל שלך
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell requireAuth={false}>
      <div dir="rtl" className="mx-auto max-w-xl py-6 space-y-5">
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-muted-foreground">שאלה {step + 1} מתוך {total}</span>
            <span className="text-muted-foreground">{COMMUNITY_LABEL[community]}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card key={current.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-1">
              <div className="text-lg font-bold leading-snug">{current.text.he}</div>
              {current.text.am && (
                <div className="text-sm text-muted-foreground" lang="am" dir="ltr">{current.text.am}</div>
              )}
            </div>
            <div className="grid gap-2">
              {current.options.map((opt, i) => (
                <Button
                  key={i}
                  onClick={() => pickAnswer(i)}
                  variant="outline"
                  size="lg"
                  disabled={saving}
                  className="h-auto min-h-14 whitespace-normal text-start justify-start text-base font-medium py-3 px-4 hover:bg-primary/10 hover:border-primary"
                >
                  <span className="me-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold">
                    {String.fromCharCode(1488 + i)}
                  </span>
                  <span>{opt.he}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {step > 0 && (
          <div className="text-center">
            <button onClick={() => setStep(step - 1)} className="text-xs text-muted-foreground hover:underline">
              ← שאלה קודמת
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
