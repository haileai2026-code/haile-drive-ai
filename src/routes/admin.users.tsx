import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, UserPlus, Shield, Power } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/ops-data";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
});

type Row = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  branch: string | null;
  is_active: boolean;
  roles: Role[];
};

const ROLES: Role[] = ["owner", "staff", "teacher", "student"];

function UsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id,email,full_name,phone,branch,is_active").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    const byUser: Record<string, Role[]> = {};
    (roles ?? []).forEach((r: any) => {
      (byUser[r.user_id] ??= []).push(r.role);
    });
    setRows((profiles ?? []).map((p: any) => ({ ...p, roles: byUser[p.id] ?? [] })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleRole = async (userId: string, role: Role, has: boolean) => {
    setBusy(userId + role);
    if (has) {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    } else {
      await supabase.from("user_roles").insert({ user_id: userId, role });
    }
    setBusy(null);
    await load();
  };

  const toggleActive = async (userId: string, current: boolean) => {
    setBusy(userId);
    await supabase.from("profiles").update({ is_active: !current }).eq("id", userId);
    setBusy(null);
    await load();
  };

  return (
    <AdminShell title="User Management">
      {msg && <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">{msg}</div>}

      <div className="mb-6 rounded-2xl border border-border/60 bg-card/40 p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold"><UserPlus className="h-4 w-4" /> Invite a user</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Have new users sign up at <span className="font-mono text-gold">/login</span>. They land as <b>lead</b> by default; assign roles below.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading users…</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-card/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start">User</th>
                <th className="px-4 py-3 text-start">Roles</th>
                <th className="px-4 py-3 text-start">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{r.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                    {r.phone && <div className="text-xs text-muted-foreground">{r.phone}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {ROLES.map((role) => {
                        const has = r.roles.includes(role);
                        return (
                          <button
                            key={role}
                            disabled={busy === r.id + role}
                            onClick={() => toggleRole(r.id, role, has)}
                            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs capitalize transition ${
                              has ? "border-gold/40 bg-gold/15 text-gold" : "border-border/60 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Shield className="h-3 w-3" /> {role}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      disabled={busy === r.id}
                      onClick={() => toggleActive(r.id, r.is_active)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                        r.is_active ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                      }`}
                    >
                      <Power className="h-3 w-3" /> {r.is_active ? "Active" : "Disabled"}
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No users yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
