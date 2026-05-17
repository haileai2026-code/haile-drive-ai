import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell, AdminLoading } from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Heart, Activity, ChevronLeft, Download } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { generateDiagnosticPdf } from "@/lib/diagnostics/pdf-report";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/diagnostics")({
  head: () => ({ meta: [{ title: "דוחות אבחון — Owner" }] }),
  component: AdminDiagnosticsPage,
});

type Answer = {
  qId: string;
  score: number;
  rtMs: number;
  bpmAtAnswer: number | null;
  emotionAtAnswer: {
    anxiety: number; focus: number; confidence: number; confusion: number;
  } | null;
};

type Session = {
  id: string;
  student_id: string;
  start_time: string;
  end_time: string | null;
  community_type: string | null;
  psychological_score: number | null;
  baseline_hr: number | null;
  stress_hr: number | null;
  accuracy_score: number | null;
  final_beqa_score: number | null;
  recommendation: string | null;
  assessment_type: string;
  answers: Answer[] | null;
  metadata: Record<string, unknown> | null;
};

type Profile = { id: string; full_name: string | null; email: string | null };

function recBadge(letter: string | null, beqa: number | null) {
  const score = beqa ?? 0;
  if (letter === "A" || score >= 75)
    return { emoji: "🟢", label: "A — מומלץ מאוד", color: "bg-emerald-500/20 text-emerald-500 border-emerald-500/40" };
  if (letter === "B" || score >= 55)
    return { emoji: "🟡", label: "B — ראיון נוסף", color: "bg-amber-500/20 text-amber-500 border-amber-500/40" };
  return { emoji: "🔴", label: "C — לא מומלץ", color: "bg-red-500/20 text-red-500 border-red-500/40" };
}

function AdminDiagnosticsPage() {
  const [rows, setRows] = useState<Session[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("beqa_diagnostic_sessions")
        .select("*")
        .eq("assessment_type", "unified")
        .order("start_time", { ascending: false })
        .limit(300);
      const list = (data ?? []) as unknown as Session[];
      setRows(list);
      const ids = Array.from(new Set(list.map((r) => r.student_id)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles").select("id, full_name, email").in("id", ids);
        const map: Record<string, Profile> = {};
        (profs ?? []).forEach((p) => { map[p.id] = p as Profile; });
        setProfiles(map);
      }
      setLoading(false);
    })();
  }, []);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  if (loading) return <AdminShell title="דוחות אבחון" roles={["owner", "staff"]}><AdminLoading /></AdminShell>;

  return (
    <AdminShell title="🧠 דוחות אבחון מאוחד" roles={["owner", "staff"]}>
      {selected ? (
        <SessionDetail
          session={selected}
          profile={profiles[selected.student_id]}
          onBack={() => setSelectedId(null)}
        />
      ) : (
        <SessionList rows={rows} profiles={profiles} onSelect={setSelectedId} />
      )}
    </AdminShell>
  );
}

function SessionList({
  rows, profiles, onSelect,
}: {
  rows: Session[];
  profiles: Record<string, Profile>;
  onSelect: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">סשני אבחון אחרונים ({rows.length})</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">אין עדיין סשני אבחון מאוחד.</p>
        )}
        {rows.map((r) => {
          const p = profiles[r.student_id];
          const rec = recBadge(r.recommendation, r.final_beqa_score);
          return (
            <button
              key={r.id}
              onClick={() => onSelect(r.id)}
              className="w-full text-right rounded-lg border border-border/60 p-3 hover:bg-muted/40 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">
                    {p?.full_name || p?.email || r.student_id.slice(0, 8)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(r.start_time).toLocaleString("he-IL")} ·
                    {" "}{r.community_type ?? "—"} ·
                    {" "}<Heart className="inline h-3 w-3 text-red-500" /> {r.baseline_hr ?? "—"}→{r.stress_hr ?? "—"}
                  </div>
                </div>
                <Badge variant="outline" className={`${rec.color} whitespace-nowrap`}>
                  {rec.emoji} {Math.round(r.final_beqa_score ?? 0)}
                </Badge>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function SessionDetail({
  session, profile, onBack,
}: {
  session: Session;
  profile: Profile | undefined;
  onBack: () => void;
}) {
  const meta = (session.metadata ?? {}) as {
    biometric_score?: number;
    face_score?: number;
    stability?: number;
    bpm_series?: { t: number; bpm: number; hrv: number }[];
    emotion_series?: { t: number; anxiety: number; focus: number; confidence: number; confusion: number }[];
    insights?: string[];
  };
  const answers = session.answers ?? [];
  const rec = recBadge(session.recommendation, session.final_beqa_score);
  const bpmSeries = (meta.bpm_series ?? []).map((p) => ({
    t: Math.round(p.t / 1000),
    BPM: Math.round(p.bpm),
  }));
  const emoSeries = (meta.emotion_series ?? []).map((p) => ({
    t: Math.round(p.t / 1000),
    חרדה: Math.round(p.anxiety * 100),
    ריכוז: Math.round(p.focus * 100),
    ביטחון: Math.round(p.confidence * 100),
  }));

  // face averages
  const avg = (k: "anxiety" | "focus" | "confidence") => {
    const arr = meta.emotion_series ?? [];
    if (!arr.length) return 0;
    return Math.round((arr.reduce((a, b) => a + b[k], 0) / arr.length) * 100);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button size="sm" variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 ml-1" /> חזרה לרשימה
        </Button>
        <Badge variant="outline" className={`${rec.color} text-sm`}>
          {rec.emoji} {rec.label}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {profile?.full_name || profile?.email || session.student_id.slice(0, 8)}
          </CardTitle>
          <div className="text-xs text-muted-foreground">
            {new Date(session.start_time).toLocaleString("he-IL")} · קהילה: {session.community_type ?? "—"}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <ScoreTile icon={Brain} label="BEQA כולל" value={`${Math.round(session.final_beqa_score ?? 0)}/100`} />
            <ScoreTile icon={Brain} label="פסיכולוגי" value={`${Math.round(session.psychological_score ?? 0)}/100`} />
            <ScoreTile icon={Activity} label="ביומטרי" value={`${Math.round(meta.biometric_score ?? 0)}/100`} />
            <ScoreTile icon={Heart} label="ניתוח פנים" value={`${Math.round(meta.face_score ?? 0)}/100`} />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
            <Stat label="ריכוז ממוצע" value={`${avg("focus")}%`} tone="emerald" />
            <Stat label="חרדה ממוצעת" value={`${avg("anxiety")}%`} tone="red" />
            <Stat label="ביטחון ממוצע" value={`${avg("confidence")}%`} tone="blue" />
          </div>
        </CardContent>
      </Card>

      {bpmSeries.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">דופק לאורך המבחן</CardTitle></CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bpmSeries}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="t" fontSize={10} label={{ value: "שניות", position: "insideBottom", fontSize: 10 }} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Line type="monotone" dataKey="BPM" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {emoSeries.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">רגשות לאורך המבחן</CardTitle></CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={emoSeries}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="t" fontSize={10} />
                <YAxis domain={[0, 100]} fontSize={10} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="חרדה" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ריכוז" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ביטחון" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">פירוט שאלות ({answers.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {answers.map((a, i) => (
            <div key={i} className="rounded-lg border border-border/60 p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="font-medium">שאלה {i + 1} <span className="text-xs text-muted-foreground">({a.qId})</span></div>
                <Badge variant="outline">ציון: {a.score}/4</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-3">
                <span>⏱ {(a.rtMs / 1000).toFixed(1)}s</span>
                <span><Heart className="inline h-3 w-3 text-red-500" /> {a.bpmAtAnswer ?? "—"} BPM</span>
                {a.emotionAtAnswer && (
                  <>
                    <span>חרדה {Math.round(a.emotionAtAnswer.anxiety * 100)}%</span>
                    <span>ריכוז {Math.round(a.emotionAtAnswer.focus * 100)}%</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {meta.insights && meta.insights.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">תובנות אוטומטיות</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {meta.insights.map((s, i) => (
              <div key={i} className="text-sm">• {s}</div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScoreTile({ icon: Icon, label, value }: { icon: typeof Brain; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "emerald" | "red" | "blue" }) {
  const color =
    tone === "emerald" ? "text-emerald-500" :
    tone === "red" ? "text-red-500" : "text-blue-500";
  return (
    <div className="rounded-lg border border-border/60 p-2 text-center">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-base font-bold ${color}`}>{value}</div>
    </div>
  );
}
