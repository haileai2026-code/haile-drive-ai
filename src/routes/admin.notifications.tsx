import { createFileRoute } from "@tanstack/react-router";
import { AdminShell, AdminLoading } from "@/components/AdminShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Send, Trash2, MessageSquare, Phone, Loader2, Bell, Clock } from "lucide-react";
import {
  adminApi,
  notificationsApi,
  scheduleApi,
  type NotificationChannel,
  type NotificationRow,
} from "@/lib/admin-api";
import { sendNotificationNow } from "@/lib/notifications.functions";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({ meta: [{ title: "תזכורות SMS/WhatsApp — Haile Drive AI" }] }),
  component: NotificationsPage,
});

const STATUS_META: Record<NotificationRow["status"], { label: string; cls: string }> = {
  pending: { label: "ממתין", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  sent: { label: "נשלח", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  failed: { label: "נכשל", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  cancelled: { label: "בוטל", cls: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30" },
};

type Tone = "24h" | "2h" | "morning" | "manual";
const TONES: { id: Tone; label: string }[] = [
  { id: "24h", label: "24 שעות לפני" },
  { id: "2h", label: "שעתיים לפני" },
  { id: "morning", label: "בוקר היום (07:00)" },
  { id: "manual", label: "ידני (עכשיו)" },
];

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().replace(/[\s\-()]/g, "");
  if (!t) return null;
  if (t.startsWith("+")) return t;
  if (t.startsWith("00")) return "+" + t.slice(2);
  if (t.startsWith("0")) return "+972" + t.slice(1);
  return "+" + t;
}

function buildBilingualMessage(opts: {
  candidateName: string;
  eventTitle: string;
  date: string;
  time: string | null;
  location: string | null;
  type: string;
}) {
  const when = `${opts.date}${opts.time ? ` ${opts.time.slice(0, 5)}` : ""}`;
  const where = opts.location ? ` · ${opts.location}` : "";
  const heLabel =
    opts.type === "exam" ? "מבחן" : opts.type === "makeup" ? "השלמה" : "שיעור";
  const amLabel = opts.type === "exam" ? "ፈተና" : opts.type === "makeup" ? "ማካካሻ" : "ትምህርት";
  return [
    `שלום ${opts.candidateName}, תזכורת ל${heLabel}: ${opts.eventTitle} — ${when}${where}.`,
    `ሰላም ${opts.candidateName}፣ ${amLabel} ማስታወሻ፦ ${opts.eventTitle} — ${when}${where}.`,
    `Haile Drive AI`,
  ].join("\n");
}

function computeScheduledAt(tone: Tone, eventDate: string, eventTime: string | null): Date {
  if (tone === "manual") return new Date();
  const base = new Date(`${eventDate}T${(eventTime || "08:00").slice(0, 5)}:00`);
  if (tone === "24h") return new Date(base.getTime() - 24 * 3600 * 1000);
  if (tone === "2h") return new Date(base.getTime() - 2 * 3600 * 1000);
  // morning
  const m = new Date(`${eventDate}T07:00:00`);
  return m;
}

function NotificationsPage() {
  const qc = useQueryClient();
  const sendNow = useServerFn(sendNotificationNow);

  const { data: events } = useQuery({ queryKey: ["schedule"], queryFn: () => scheduleApi.list() });
  const { data: candidates } = useQuery({ queryKey: ["candidates"], queryFn: () => adminApi.listCandidates() });
  const { data: classes } = useQuery({ queryKey: ["classes"], queryFn: adminApi.listClasses });
  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: notificationsApi.list,
    refetchInterval: 15000,
  });

  const [eventId, setEventId] = useState("");
  const [channel, setChannel] = useState<NotificationChannel>("whatsapp");
  const [tone, setTone] = useState<Tone>("24h");
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, boolean>>({});
  const [customMsg, setCustomMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const event = useMemo(() => events?.find((e) => e.id === eventId), [events, eventId]);

  const eligibleCandidates = useMemo(() => {
    if (!event) return [];
    if (event.candidate_id) {
      return (candidates ?? []).filter((c) => c.id === event.candidate_id);
    }
    if (event.class_id) {
      return (candidates ?? []).filter((c) => c.class_id === event.class_id);
    }
    return candidates ?? [];
  }, [event, candidates]);

  const className = (id: string | null) => classes?.find((c) => c.id === id)?.name ?? "—";

  function toggleAll(v: boolean) {
    const next: Record<string, boolean> = {};
    if (v) eligibleCandidates.forEach((c) => (next[c.id] = true));
    setSelectedCandidates(next);
  }

  async function enqueue() {
    if (!event) return toast.error("בחר אירוע");
    const targets = eligibleCandidates.filter((c) => selectedCandidates[c.id]);
    if (!targets.length) return toast.error("בחר לפחות נמען אחד");

    const scheduledAt = computeScheduledAt(tone, event.event_date, event.start_time).toISOString();
    const rows: any[] = [];
    const skipped: string[] = [];

    for (const cand of targets) {
      const phone = normalizePhone(cand.phone);
      if (!phone) {
        skipped.push(cand.full_name);
        continue;
      }
      const msg =
        customMsg.trim() ||
        buildBilingualMessage({
          candidateName: cand.full_name,
          eventTitle: event.title,
          date: event.event_date,
          time: event.start_time,
          location: event.location,
          type: event.type,
        });
      rows.push({
        candidate_id: cand.id,
        event_id: event.id,
        channel,
        to_phone: phone,
        message: msg,
        language: cand.language || "he",
        scheduled_at: scheduledAt,
        status: "pending",
      });
    }

    if (!rows.length) return toast.error("אף נמען עם טלפון תקין");

    try {
      setBusy(true);
      await notificationsApi.insertMany(rows);
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(
        `${rows.length} תזכורות נוספו לתור${skipped.length ? ` · דולגו ${skipped.length} ללא טלפון` : ""}`,
      );
      setSelectedCandidates({});
      setCustomMsg("");
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה בהוספה");
    } finally {
      setBusy(false);
    }
  }

  async function sendOne(id: string) {
    try {
      const r = await sendNow({ data: { id } });
      if ((r as any).ok) toast.success("נשלח");
      else toast.error((r as any).error ?? "נכשל");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה");
    }
  }

  return (
    <AdminShell title="תזכורות SMS / WhatsApp">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* Composer */}
        <section className="rounded-2xl border border-border/60 bg-card/40 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-gold">
            <Bell className="h-4 w-4" /> יצירת תזכורות חדשות
          </div>

          <div className="space-y-3">
            <label className="block text-xs text-muted-foreground">אירוע מהלוז</label>
            <select
              value={eventId}
              onChange={(e) => {
                setEventId(e.target.value);
                setSelectedCandidates({});
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">בחר אירוע…</option>
              {(events ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.event_date} · {e.title} ({className(e.class_id)})
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-muted-foreground">ערוץ</label>
                <div className="mt-1 flex rounded-md border border-input bg-background p-1">
                  {(["whatsapp", "sms"] as NotificationChannel[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setChannel(c)}
                      className={`flex-1 rounded px-2 py-1.5 text-xs ${
                        channel === c ? "bg-gold/15 text-gold" : "text-muted-foreground"
                      }`}
                    >
                      {c === "whatsapp" ? (
                        <span className="flex items-center justify-center gap-1"><MessageSquare className="h-3 w-3" /> WhatsApp</span>
                      ) : (
                        <span className="flex items-center justify-center gap-1"><Phone className="h-3 w-3" /> SMS</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground">תזמון</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as Tone)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                >
                  {TONES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs text-muted-foreground">נמענים ({eligibleCandidates.length})</label>
                <div className="flex gap-2 text-[11px]">
                  <button onClick={() => toggleAll(true)} className="text-gold hover:underline">סמן הכל</button>
                  <button onClick={() => toggleAll(false)} className="text-muted-foreground hover:underline">נקה</button>
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto rounded-md border border-border/60 bg-background/40 p-2">
                {!event && <div className="p-3 text-center text-xs text-muted-foreground">בחר אירוע כדי לראות נמענים</div>}
                {event && eligibleCandidates.length === 0 && (
                  <div className="p-3 text-center text-xs text-muted-foreground">אין מועמדים בכיתה זו</div>
                )}
                {eligibleCandidates.map((c) => {
                  const phone = normalizePhone(c.phone);
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        checked={!!selectedCandidates[c.id]}
                        disabled={!phone}
                        onChange={(e) =>
                          setSelectedCandidates((s) => ({ ...s, [c.id]: e.target.checked }))
                        }
                      />
                      <span className="flex-1 truncate">{c.full_name}</span>
                      <span className={`text-[11px] ${phone ? "text-muted-foreground" : "text-rose-400"}`}>
                        {phone ?? "אין טלפון"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground">הודעה מותאמת (אופציונלי)</label>
              <textarea
                value={customMsg}
                onChange={(e) => setCustomMsg(e.target.value)}
                rows={3}
                placeholder="ריק = הודעה דו-לשונית אוטומטית (עברית + אמהרית)"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <button
              disabled={busy || !event}
              onClick={enqueue}
              className="w-full rounded-md bg-gold px-4 py-2 text-sm font-bold text-gold-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "הוסף לתור"}
            </button>
            <p className="text-[11px] text-muted-foreground">
              תזכורות מתוזמנות יישלחו אוטומטית כל 5 דק' ע"י ה-cron. שליחה ידנית זמינה ברשימה למטה.
            </p>
          </div>
        </section>

        {/* History */}
        <section className="rounded-2xl border border-border/60 bg-card/40 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-gold">
            <Clock className="h-4 w-4" /> תור והיסטוריה
          </div>
          {isLoading ? (
            <AdminLoading />
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {(notifications ?? []).map((n) => {
                const meta = STATUS_META[n.status];
                const cand = candidates?.find((c) => c.id === n.candidate_id);
                return (
                  <div
                    key={n.id}
                    className="rounded-xl border border-border/60 bg-background/40 p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${meta.cls}`}>
                            {meta.label}
                          </span>
                          <span className="text-[10px] uppercase text-muted-foreground">
                            {n.channel}
                          </span>
                          <span className="truncate text-xs font-semibold">
                            {cand?.full_name ?? "—"} · {n.to_phone}
                          </span>
                        </div>
                        <div className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">
                          {n.message}
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          מתוזמן: {new Date(n.scheduled_at).toLocaleString("he-IL")}
                          {n.sent_at && ` · נשלח: ${new Date(n.sent_at).toLocaleString("he-IL")}`}
                          {n.error && ` · שגיאה: ${n.error}`}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        {n.status === "pending" && (
                          <button
                            title="שלח עכשיו"
                            onClick={() => sendOne(n.id)}
                            className="rounded border border-gold/40 p-1.5 text-gold hover:bg-gold/10"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          title="מחק"
                          onClick={async () => {
                            await notificationsApi.remove(n.id);
                            qc.invalidateQueries({ queryKey: ["notifications"] });
                          }}
                          className="rounded border border-border/60 p-1.5 text-muted-foreground hover:bg-accent"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!notifications?.length && (
                <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                  אין תזכורות עדיין
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
