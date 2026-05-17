import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminLoading, AdminShell } from "@/components/AdminShell";
import { adminApi } from "@/lib/admin-api";
import { createUserAccount } from "@/lib/admin-users.functions";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";
import { UserCog, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/teachers")({
  head: () => ({ meta: [{ title: "מרצים והרשאות — Haile Drive AI" }] }),
  component: TeachersPage,
});

type NewUserForm = { email: string; password: string; full_name: string; phone: string; role: "teacher" | "student" | "staff" };
const emptyUser: NewUserForm = { email: "", password: "", full_name: "", phone: "", role: "teacher" };

function TeachersPage() {
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const canQuery = !loading && !!user;
  const usersQ = useQuery({ queryKey: ["all-users"], queryFn: adminApi.listAllUsers, enabled: canQuery });
  const teachersQ = useQuery({ queryKey: ["teachers"], queryFn: adminApi.listTeachers, enabled: canQuery });
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: adminApi.listClasses, enabled: canQuery });
  const createUser = useServerFn(createUserAccount);

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

  const createMut = useMutation({
    mutationFn: (form: NewUserForm) => createUser({ data: { ...form, phone: form.phone || null } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-users"] });
      qc.invalidateQueries({ queryKey: ["teachers"] });
      setNewUser(null);
      toast.success("חשבון נוצר");
    },
    onError: (e: any) => toast.error(e.message ?? "יצירה נכשלה"),
  });

  const [tab, setTab] = useState<"users" | "assign">("users");
  const [newUser, setNewUser] = useState<NewUserForm | null>(null);
  const isLoading = usersQ.isLoading || teachersQ.isLoading || classesQ.isLoading;
  const loadError = usersQ.error || teachersQ.error || classesQ.error;

  return (
    <AdminShell title="מרצים והרשאות">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button onClick={() => setTab("users")} className={`rounded-xl px-4 py-2 text-sm ${tab === "users" ? "bg-gold text-gold-foreground" : "border border-border/60"}`}>הרשאות מרצה</button>
        <button onClick={() => setTab("assign")} className={`rounded-xl px-4 py-2 text-sm ${tab === "assign" ? "bg-gold text-gold-foreground" : "border border-border/60"}`}>שיבוץ לכיתות</button>
        <button onClick={() => setNewUser({ ...emptyUser })} className="ms-auto inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-semibold text-gold-foreground">
          <Plus className="h-4 w-4" /> חשבון חדש
        </button>
      </div>

      {isLoading && <AdminLoading label="טוען משתמשים, מרצים וכיתות מהמסד…" />}
      {loadError && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
          טעינת הנתונים נכשלה: {(loadError as Error).message}
        </div>
      )}

      {tab === "users" && (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-3 py-2">שם</th><th className="px-3 py-2">אימייל</th><th className="px-3 py-2 w-40">מרצה?</th></tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading && <tr><td colSpan={3} className="px-3 py-10 text-center text-muted-foreground">טוען נתונים חיים…</td></tr>}
              {!isLoading && usersQ.data?.length === 0 && <tr><td colSpan={3} className="px-3 py-10 text-center text-muted-foreground">אין משתמשים להצגה</td></tr>}
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
                        <UserCog className="h-3.5 w-3.5" /> {isT ? "מרצה" : "הפוך למרצה"}
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
              <tr><th className="px-3 py-2">כיתה</th><th className="px-3 py-2">מרצה משויך</th></tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading && <tr><td colSpan={2} className="px-3 py-10 text-center text-muted-foreground">טוען נתונים חיים…</td></tr>}
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
                      <option value="">— ללא מרצה —</option>
                      {teachersQ.data?.map((t) => <option key={t.id} value={t.id}>{t.full_name ?? t.email}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {newUser && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setNewUser(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-background p-5" dir="rtl">
            <h3 className="mb-4 text-lg font-bold">יצירת חשבון חדש</h3>
            <form onSubmit={(e) => { e.preventDefault(); if (!newUser.email || newUser.password.length < 8 || !newUser.full_name) { toast.error("מלא את כל השדות (סיסמה ≥ 8 תווים)"); return; } createMut.mutate(newUser); }} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">שם מלא *</span>
                <input required value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">אימייל *</span>
                <input type="email" required value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">סיסמה ראשונית * (≥ 8 תווים)</span>
                <input type="text" required minLength={8} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">טלפון</span>
                <input value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold">תפקיד *</span>
                <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="teacher">מרצה</option>
                  <option value="student">תלמיד</option>
                  <option value="staff">צוות</option>
                </select>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setNewUser(null)} className="rounded-lg border border-border/60 px-4 py-2 text-sm">ביטול</button>
                <button type="submit" disabled={createMut.isPending} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground disabled:opacity-50">{createMut.isPending ? "יוצר…" : "צור חשבון"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
