import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/AdminShell";
import { adminApi } from "@/lib/admin-api";
import { useState } from "react";
import { toast } from "sonner";
import { UserCog } from "lucide-react";

export const Route = createFileRoute("/admin/teachers")({
  head: () => ({ meta: [{ title: "מורים והרשאות — Haile Drive AI" }] }),
  component: TeachersPage,
});

function TeachersPage() {
  const qc = useQueryClient();
  const usersQ = useQuery({ queryKey: ["all-users"], queryFn: adminApi.listAllUsers });
  const teachersQ = useQuery({ queryKey: ["teachers"], queryFn: adminApi.listTeachers });
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: adminApi.listClasses });

  const teacherIds = new Set((teachersQ.data ?? []).map((t) => t.id));

  const toggleMut = useMutation({
    mutationFn: ({ userId, makeTeacher }: { userId: string; makeTeacher: boolean }) =>
      adminApi.setUserRole(userId, "teacher", makeTeacher),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teachers"] }); toast.success("עודכן"); },
    onError: (e: any) => toast.error(e.message),
  });

  const assignClassMut = useMutation({
    mutationFn: ({ classId, teacherId }: { classId: string; teacherId: string | null }) =>
      adminApi.upsertClass({ id: classId, name: classesQ.data!.find((c) => c.id === classId)!.name, teacher_id: teacherId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["classes"] }); toast.success("שובץ"); },
    onError: (e: any) => toast.error(e.message),
  });

  const [tab, setTab] = useState<"users" | "assign">("users");

  return (
    <AdminShell title="מורים והרשאות">
      <div className="mb-4 flex gap-2">
        <button onClick={() => setTab("users")} className={`rounded-xl px-4 py-2 text-sm ${tab === "users" ? "bg-gold text-gold-foreground" : "border border-border/60"}`}>הרשאות מורה</button>
        <button onClick={() => setTab("assign")} className={`rounded-xl px-4 py-2 text-sm ${tab === "assign" ? "bg-gold text-gold-foreground" : "border border-border/60"}`}>שיבוץ לכיתות</button>
      </div>

      {tab === "users" && (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-3 py-2">שם</th><th className="px-3 py-2">אימייל</th><th className="px-3 py-2 w-40">מורה?</th></tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {usersQ.data?.map((u) => {
                const isT = teacherIds.has(u.id);
                return (
                  <tr key={u.id}>
                    <td className="px-3 py-3 font-semibold">{u.full_name ?? "—"}</td>
                    <td className="px-3 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => toggleMut.mutate({ userId: u.id, makeTeacher: !isT })}
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold ${isT ? "bg-emerald-500/15 text-emerald-300" : "border border-border/60 text-muted-foreground"}`}
                      >
                        <UserCog className="h-3.5 w-3.5" /> {isT ? "מורה" : "הפוך למורה"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "assign" && (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-3 py-2">כיתה</th><th className="px-3 py-2">מורה משויך</th></tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {classesQ.data?.length === 0 && <tr><td colSpan={2} className="px-3 py-6 text-center text-muted-foreground">אין כיתות. צור כיתה במסך "כיתות וקבוצות".</td></tr>}
              {classesQ.data?.map((cl) => (
                <tr key={cl.id}>
                  <td className="px-3 py-3 font-semibold">{cl.name}</td>
                  <td className="px-3 py-3">
                    <select
                      value={cl.teacher_id ?? ""}
                      onChange={(e) => assignClassMut.mutate({ classId: cl.id, teacherId: e.target.value || null })}
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    >
                      <option value="">— ללא מורה —</option>
                      {teachersQ.data?.map((t) => <option key={t.id} value={t.id}>{t.full_name ?? t.email}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
