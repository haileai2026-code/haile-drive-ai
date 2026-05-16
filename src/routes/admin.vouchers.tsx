import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminShell, AdminLoading, StatCard } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { adminApi } from "@/lib/admin-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, Plus, X, Upload, AlertTriangle, Clock, CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/vouchers")({
  head: () => ({ meta: [{ title: "מעקב ויצ\"ר — Haile Drive AI" }] }),
  component: VouchersPage,
});

type PaymentStatus = "pending" | "submitted" | "received";
type VoucherRow = {
  id: string;
  candidate_id: string;
  class_id: string | null;
  voucher_amount: number;
  course_start_date: string | null;
  payment_1_status: PaymentStatus;
  payment_1_date: string | null;
  payment_1_doc_url: string | null;
  payment_1_amount: number;
  payment_2_status: PaymentStatus;
  payment_2_date: string | null;
  payment_2_doc_url: string | null;
  payment_2_amount: number;
  payment_3_status: PaymentStatus;
  payment_3_date: string | null;
  payment_3_doc_url: string | null;
  payment_3_amount: number;
  total_received: number;
  notes: string | null;
};

const STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "ממתין",
  submitted: "הוגש",
  received: "התקבל",
};

const STATUS_ICON: Record<PaymentStatus, string> = {
  pending: "⬜",
  submitted: "🟡",
  received: "✅",
};

function VouchersPage() {
  const qc = useQueryClient();
  const vouchersQ = useQuery({
    queryKey: ["vouchers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voucher_tracking")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VoucherRow[];
    },
  });
  const candidatesQ = useQuery({ queryKey: ["candidates"], queryFn: () => adminApi.listCandidates() });
  const citiesQ = useQuery({ queryKey: ["cities"], queryFn: async () => {
    const { data } = await supabase.from("cities").select("id,name,name_he");
    return data ?? [];
  } });

  const [filter, setFilter] = useState<"all" | "pending" | "submitted" | "completed">("all");
  const [editing, setEditing] = useState<{ row: VoucherRow; payment: 1 | 2 | 3 } | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const cityById = useMemo(() => Object.fromEntries((citiesQ.data ?? []).map((c: any) => [c.id, c.name_he || c.name])), [citiesQ.data]);
  const candById = useMemo(() => Object.fromEntries((candidatesQ.data ?? []).map((c: any) => [c.id, c])), [candidatesQ.data]);

  const rows = vouchersQ.data ?? [];
  const filtered = rows.filter((r) => {
    if (filter === "all") return true;
    const statuses = [r.payment_1_status, r.payment_2_status, r.payment_3_status];
    if (filter === "completed") return statuses.every((s) => s === "received");
    if (filter === "submitted") return statuses.some((s) => s === "submitted");
    if (filter === "pending") return statuses.some((s) => s === "pending");
    return true;
  });

  const totals = useMemo(() => {
    const expected = rows.reduce((s, r) => s + Number(r.voucher_amount || 0), 0);
    const received = rows.reduce((s, r) => s + Number(r.total_received || 0), 0);
    return { expected, received, pending: expected - received };
  }, [rows]);

  const daysSince = (date: string | null) => {
    if (!date) return null;
    return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["vouchers"] });

  return (
    <AdminShell title='💰 מעקב ויצ"ר — שוברי הכשרה' roles={["owner", "staff"]}>
      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="סה״כ צפוי" value={`₪${totals.expected.toLocaleString()}`} tone="gold" icon={Wallet} />
        <StatCard label="סה״כ התקבל" value={`₪${totals.received.toLocaleString()}`} tone="success" icon={CheckCircle2} />
        <StatCard label="ממתין" value={`₪${totals.pending.toLocaleString()}`} tone="warn" icon={Clock} />
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {([
            ["all", "הכל"],
            ["pending", "ממתין הגשה"],
            ["submitted", "הוגש"],
            ["completed", "הושלם"],
          ] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`rounded-full border px-4 py-1.5 text-sm ${
                filter === k ? "border-gold bg-gold/15 text-gold" : "border-border/60 text-muted-foreground"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <Button onClick={() => setAddOpen(true)} className="bg-gold text-gold-foreground hover:opacity-90">
          <Plus className="h-4 w-4 ml-1" /> הוסף לוויצ"ר
        </Button>
      </div>

      {vouchersQ.isLoading && <AdminLoading />}

      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/40">
        <table className="w-full text-sm">
          <thead className="bg-background/40">
            <tr className="border-b border-border/60">
              <th className="p-3 text-right">שם</th>
              <th className="p-3 text-right">עיר</th>
              <th className="p-3 text-right">תחילת קורס</th>
              <th className="p-3 text-right">תשלום 1</th>
              <th className="p-3 text-right">תשלום 2</th>
              <th className="p-3 text-right">תשלום 3</th>
              <th className="p-3 text-right">סה"כ התקבל</th>
              <th className="p-3 text-right">סכום שובר</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const cand = candById[row.candidate_id];
              const days = daysSince(row.course_start_date);
              const p1Urgent = days !== null && days >= 40 && row.payment_1_status === "pending";
              const p2Needed = days !== null && days >= 90 && row.payment_2_status === "pending";
              return (
                <tr key={row.id} className="border-b border-border/40 hover:bg-accent/40">
                  <td className="p-3 font-semibold">
                    {cand?.full_name ?? "—"}
                    {p1Urgent && (
                      <Badge variant="destructive" className="mr-2">
                        <AlertTriangle className="h-3 w-3 ml-1" /> דחוף
                      </Badge>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">{cityById[cand?.city_id] ?? "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {row.course_start_date ? new Date(row.course_start_date).toLocaleDateString("he-IL") : "—"}
                  </td>
                  <td className="p-3">
                    <PaymentCell row={row} payment={1} onClick={() => setEditing({ row, payment: 1 })} />
                  </td>
                  <td className="p-3">
                    <PaymentCell row={row} payment={2} onClick={() => setEditing({ row, payment: 2 })} extraBadge={p2Needed} />
                  </td>
                  <td className="p-3">
                    <PaymentCell row={row} payment={3} onClick={() => setEditing({ row, payment: 3 })} />
                  </td>
                  <td className="p-3 font-bold text-emerald-500">₪{Number(row.total_received).toLocaleString()}</td>
                  <td className="p-3 text-muted-foreground">₪{Number(row.voucher_amount).toLocaleString()}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && !vouchersQ.isLoading && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">אין רשומות להצגה</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditPaymentModal
          row={editing.row}
          payment={editing.payment}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}
      {addOpen && (
        <AddVoucherModal
          candidates={candidatesQ.data ?? []}
          existing={new Set(rows.map((r) => r.candidate_id))}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); refresh(); }}
        />
      )}
    </AdminShell>
  );
}

function PaymentCell({ row, payment, onClick, extraBadge }: { row: VoucherRow; payment: 1 | 2 | 3; onClick: () => void; extraBadge?: boolean }) {
  const status = row[`payment_${payment}_status` as const] as PaymentStatus;
  const date = row[`payment_${payment}_date` as const] as string | null;
  return (
    <button onClick={onClick} className="text-right transition hover:opacity-80">
      <div className="flex items-center gap-1.5">
        <span>{STATUS_ICON[status]}</span>
        <span className="text-xs font-semibold">{STATUS_LABEL[status]}</span>
        {extraBadge && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40">נדרש</Badge>}
      </div>
      {date && <div className="text-[10px] text-muted-foreground">{new Date(date).toLocaleDateString("he-IL")}</div>}
    </button>
  );
}

function EditPaymentModal({ row, payment, onClose, onSaved }: { row: VoucherRow; payment: 1 | 2 | 3; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<PaymentStatus>(row[`payment_${payment}_status` as const] as PaymentStatus);
  const [date, setDate] = useState<string>(row[`payment_${payment}_date` as const] ?? "");
  const [amount, setAmount] = useState<number>(Number(row[`payment_${payment}_amount` as const] || 0));
  const [docUrl, setDocUrl] = useState<string | null>(row[`payment_${payment}_doc_url` as const] as string | null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    const path = `${row.candidate_id}/p${payment}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("voucher-documents").upload(path, file, { upsert: true });
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    setDocUrl(path);
    toast.success("המסמך הועלה");
  };

  const save = async () => {
    setSaving(true);
    const patch: Record<string, any> = {
      [`payment_${payment}_status`]: status,
      [`payment_${payment}_date`]: date || null,
      [`payment_${payment}_amount`]: amount,
      [`payment_${payment}_doc_url`]: docUrl,
    };
    // Recalc total_received
    const amounts = [1, 2, 3].map((p) => {
      const s = p === payment ? status : (row[`payment_${p}_status` as const] as PaymentStatus);
      const a = p === payment ? amount : Number(row[`payment_${p}_amount` as const] || 0);
      return s === "received" ? a : 0;
    });
    patch.total_received = amounts.reduce((s, a) => s + a, 0);

    const { error } = await supabase.from("voucher_tracking").update(patch).eq("id", row.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("עודכן בהצלחה");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-background p-5" dir="rtl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">עדכון תשלום {payment}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">סטטוס</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="pending">⬜ ממתין</option>
              <option value="submitted">🟡 הוגש</option>
              <option value="received">✅ התקבל</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">תאריך</span>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">סכום (₪)</span>
            <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">מסמך</span>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                className="text-xs"
              />
              {uploading && <span className="text-xs text-muted-foreground">מעלה…</span>}
            </div>
            {docUrl && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-500">
                <FileText className="h-3 w-3" /> מסמך הועלה
              </div>
            )}
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>ביטול</Button>
            <Button onClick={save} disabled={saving} className="bg-gold text-gold-foreground">
              <Upload className="h-4 w-4 ml-1" /> {saving ? "שומר…" : "שמור"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddVoucherModal({ candidates, existing, onClose, onSaved }: { candidates: any[]; existing: Set<string>; onClose: () => void; onSaved: () => void }) {
  const [candidateId, setCandidateId] = useState("");
  const [amount, setAmount] = useState(25000);
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);

  const eligible = candidates.filter((c) => !existing.has(c.id));

  const save = async () => {
    if (!candidateId) { toast.error("בחר מועמד"); return; }
    setSaving(true);
    const cand = candidates.find((c) => c.id === candidateId);
    const { error } = await supabase.from("voucher_tracking").insert({
      candidate_id: candidateId,
      class_id: cand?.class_id ?? null,
      voucher_amount: amount,
      course_start_date: startDate || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("נוסף לוויצ\"ר");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-background p-5" dir="rtl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">הוסף סטודנט לוויצ"ר</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">מועמד *</span>
            <select value={candidateId} onChange={(e) => setCandidateId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">— בחר —</option>
              {eligible.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">סכום השובר (₪)</span>
            <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">תאריך תחילת קורס</span>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>ביטול</Button>
            <Button onClick={save} disabled={saving} className="bg-gold text-gold-foreground">
              {saving ? "שומר…" : "הוסף"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
