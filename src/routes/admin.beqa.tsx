import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell, AdminLoading, StatCard } from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Brain, Heart, TrendingUp, Trophy, Users } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  BarChart, Bar,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { interpretBeqa } from "@/lib/beqa-questions";

export const Route = createFileRoute("/admin/beqa")({
  head: () => ({ meta: [{ title: "BEQA — Owner Dashboard" }] }),
  component: AdminBeqaPage,
});

type Row = {
  id: string;
  student_id: string;
  start_time: string;
  end_time: string | null;
  baseline_hr: number | null;
  stress_hr: number | null;
  reaction_time_avg: number | null;
  accuracy_score: number | null;
  final_beqa_score: number | null;
  metadata: Record<string, unknown> | null;
};
type Profile = { id: string; full_name: string | null; email: string | null };

function AdminBeqaPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("beqa_diagnostic_sessions")
        .select("*")
        .not("final_beqa_score", "is", null)
        .order("start_time", { ascending: false })
        .limit(200);
      const list = (data ?? []) as Row[];
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

  if (loading) return <AdminShell title="BEQA — אבחון ביומטרי"><AdminLoading /></AdminShell>;

  const completed = rows.length;
  const avgBeqa = completed
    ? Math.round((rows.reduce((a, r) => a + (r.final_beqa_score ?? 0), 0) / completed) * 10) / 10
    : 0;
  const uniqueStudents = new Set(rows.map((r) => r.student_id)).size;
  const avgAccuracy = completed
    ? Math.round((rows.reduce((a, r) => a + (r.accuracy_score ?? 0), 0) / completed) * 10) / 10
    : 0;

  // Trend: avg BEQA over last 30 sessions chronologically
  const trend = [...rows].slice(0, 30).reverse().map((r, i) => ({
    name: `#${i + 1}`,
    BEQA: r.final_beqa_score ?? 0,
    דיוק: r.accuracy_score ?? 0,
  }));

  // Score buckets
  const buckets = [
    { name: "85–100", count: 0 },
    { name: "70–84", count: 0 },
    { name: "50–69", count: 0 },
    { name: "0–49", count: 0 },
  ];
  rows.forEach((r) => {
    const s = r.final_beqa_score ?? 0;
    if (s >= 85) buckets[0].count++;
    else if (s >= 70) buckets[1].count++;
    else if (s >= 50) buckets[2].count++;
    else buckets[3].count++;
  });

  return (
    <AdminShell title="BEQA — אבחון ביומטרי" roles={["owner"]}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="סשנים שהושלמו" value={completed} icon={Trophy} tone="gold" />
          <StatCard label="ממוצע BEQA" value={`${avgBeqa}%`} icon={TrendingUp} tone="success" />
          <StatCard label="תלמידים פעילים" value={uniqueStudents} icon={Users} />
          <StatCard label="ממוצע דיוק" value={`${avgAccuracy}%`} icon={Brain} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">מגמת BEQA (30 סשנים אחרונים)</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis domain={[0, 100]} fontSize={10} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="BEQA" stroke="#10b981" strokeWidth={2} />
                  <Line type="monotone" dataKey="דיוק" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">פילוח ציונים</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buckets}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">סשנים אחרונים</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {rows.length === 0 && (
              <p className="text-sm text-muted-foreground">אין עדיין סשני אבחון.</p>
            )}
            {rows.slice(0, 30).map((r) => {
              const p = profiles[r.student_id];
              const score = r.final_beqa_score ?? 0;
              const meta = r.metadata ?? {};
              const stability = (meta as { stability?: number }).stability;
              const reaction = (meta as { reaction_consistency?: number }).reaction_consistency;
              return (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">
                      {p?.full_name || p?.email || r.student_id.slice(0, 8)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(r.start_time).toLocaleString("he-IL")} ·
                      {" "}דיוק {r.accuracy_score}% ·
                      {" "}<Heart className="inline h-3 w-3 text-red-500" /> {r.baseline_hr}→{r.stress_hr} ·
                      {" "}<Activity className="inline h-3 w-3" /> {r.reaction_time_avg}ms
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {stability != null && <Badge variant="outline" className="text-[10px]">יציבות {stability}%</Badge>}
                      {reaction != null && <Badge variant="outline" className="text-[10px]">עקביות {reaction}%</Badge>}
                      <Badge variant="outline" className="text-[10px]">{interpretBeqa(score)}</Badge>
                    </div>
                  </div>
                  <div className={`text-2xl font-black ${score >= 70 ? "text-emerald-500" : score >= 50 ? "text-amber-500" : "text-red-500"}`}>
                    {score}%
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
