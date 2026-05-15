import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brain, TrendingUp, Heart, Activity, Trophy, ArrowLeft } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/beqa-history")({
  component: BeqaHistoryPage,
});

type Session = {
  id: string;
  start_time: string;
  end_time: string | null;
  baseline_hr: number | null;
  stress_hr: number | null;
  reaction_time_avg: number | null;
  accuracy_score: number | null;
  final_beqa_score: number | null;
};

function BeqaHistoryPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("beqa_diagnostic_sessions")
        .select(
          "id, start_time, end_time, baseline_hr, stress_hr, reaction_time_avg, accuracy_score, final_beqa_score",
        )
        .eq("student_id", user.id)
        .not("final_beqa_score", "is", null)
        .order("start_time", { ascending: true });
      if (!error && data) setSessions(data as Session[]);
      setLoading(false);
    })();
  }, [user]);

  const chartData = sessions.map((s, i) => ({
    name: `#${i + 1}`,
    date: new Date(s.start_time).toLocaleDateString("he-IL", {
      day: "2-digit",
      month: "2-digit",
    }),
    BEQA: s.final_beqa_score ?? 0,
    דיוק: s.accuracy_score ?? 0,
    "דופק מנוחה": s.baseline_hr ?? 0,
    "דופק סטרס": s.stress_hr ?? 0,
    "זמן תגובה": s.reaction_time_avg ?? 0,
  }));

  const last = sessions[sessions.length - 1];
  const avgBeqa =
    sessions.length > 0
      ? Math.round(
          (sessions.reduce((a, s) => a + (s.final_beqa_score ?? 0), 0) /
            sessions.length) * 10,
        ) / 10
      : 0;

  return (
    <AppShell>
      <div className="space-y-4" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">היסטוריית BEQA</h1>
            <p className="text-sm text-muted-foreground">
              מעקב אחר מדד הביצוע הביומטרי-קוגניטיבי לאורך זמן
            </p>
          </div>
          <Link to="/diagnostics">
            <Button size="sm" variant="outline">
              <ArrowLeft className="ml-2 h-4 w-4" />
              אבחון חדש
            </Button>
          </Link>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              טוען נתונים…
            </CardContent>
          </Card>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <Brain className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                אין עדיין סשני אבחון מושלמים. בצע אבחון BEQA ראשון כדי להתחיל לעקוב.
              </p>
              <Link to="/diagnostics">
                <Button>התחל אבחון</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Trophy className="h-4 w-4 text-emerald-500" /> ציון אחרון
                  </div>
                  <div className="mt-1 text-2xl font-bold">
                    {last?.final_beqa_score ?? "—"}%
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <TrendingUp className="h-4 w-4 text-blue-500" /> ממוצע BEQA
                  </div>
                  <div className="mt-1 text-2xl font-bold">{avgBeqa}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Heart className="h-4 w-4 text-red-500" /> דופק מנוחה אחרון
                  </div>
                  <div className="mt-1 text-2xl font-bold">
                    {last?.baseline_hr ?? "—"}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Activity className="h-4 w-4 text-orange-500" /> סשנים סה"כ
                  </div>
                  <div className="mt-1 text-2xl font-bold">{sessions.length}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">התקדמות BEQA & דיוק</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis domain={[0, 100]} fontSize={10} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="BEQA"
                      stroke="#10b981"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="דיוק"
                      stroke="#3b82f6"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">דופק: מנוחה מול סטרס</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="דופק מנוחה"
                      stroke="#10b981"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="דופק סטרס"
                      stroke="#ef4444"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">סשנים אחרונים</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[...sessions].reverse().slice(0, 10).map((s, i) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  >
                    <div>
                      <div className="font-medium">
                        {new Date(s.start_time).toLocaleString("he-IL", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        דיוק {s.accuracy_score}% · דופק {s.baseline_hr}→{s.stress_hr} ·{" "}
                        {s.reaction_time_avg}ms
                      </div>
                    </div>
                    <div
                      className={`text-xl font-bold ${
                        (s.final_beqa_score ?? 0) >= 70
                          ? "text-emerald-500"
                          : (s.final_beqa_score ?? 0) >= 50
                          ? "text-amber-500"
                          : "text-red-500"
                      }`}
                    >
                      {s.final_beqa_score}%
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
