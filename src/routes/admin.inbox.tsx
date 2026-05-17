import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Inbox, MessageSquare, Star, Send } from "lucide-react";
import { AdminShell, AdminLoading } from "@/components/AdminShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  adminListInbox,
  updateFeedbackStatus,
  replyToContact,
  markContactRead,
} from "@/lib/community.functions";

export const Route = createFileRoute("/admin/inbox")({
  head: () => ({ meta: [{ title: "תיבת פניות — ניהול" }] }),
  component: InboxPage,
});

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m} ד׳`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ש׳`;
  return `${Math.floor(h / 24)} י׳`;
}

const TYPE_LABEL: Record<string, string> = {
  bug: "🐛 תקלה",
  feature: "💡 הצעה",
  complaint: "😤 תלונה",
  compliment: "👏 מחמאה",
};
const ROLE_LABEL: Record<string, string> = {
  owner: "🏢 הנהלה",
  teacher: "👨‍🏫 מרצה",
  secretary: "📋 מזכירה",
};

function InboxPage() {
  const fetchInbox = useServerFn(adminListInbox);
  const { data, isLoading } = useQuery({ queryKey: ["admin-inbox"], queryFn: () => fetchInbox() });

  return (
    <AdminShell title="תיבת פניות ומשובים">
      {isLoading ? (
        <AdminLoading />
      ) : (
        <Tabs defaultValue="feedback" dir="rtl">
          <TabsList className="bg-card/60">
            <TabsTrigger value="feedback" className="data-[state=active]:bg-gold/20 data-[state=active]:text-gold">
              <Star className="me-2 h-4 w-4" />
              משובים ({data?.feedback.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="contacts" className="data-[state=active]:bg-gold/20 data-[state=active]:text-gold">
              <Inbox className="me-2 h-4 w-4" />
              פניות ({(data?.contacts ?? []).filter((c: any) => !c.parent_id).length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feedback" className="mt-4 space-y-3">
            {(data?.feedback ?? []).length === 0 ? (
              <EmptyAdmin icon={Star} text="אין משובים." />
            ) : (
              (data?.feedback ?? []).map((f: any) => <FeedbackRow key={f.id} item={f} />)
            )}
          </TabsContent>

          <TabsContent value="contacts" className="mt-4 space-y-3">
            <ContactList items={data?.contacts ?? []} />
          </TabsContent>
        </Tabs>
      )}
    </AdminShell>
  );
}

function FeedbackRow({ item }: { item: any }) {
  const qc = useQueryClient();
  const update = useServerFn(updateFeedbackStatus);
  const [status, setStatus] = useState(item.status);
  const [response, setResponse] = useState(item.admin_response ?? "");
  const m = useMutation({
    mutationFn: () => update({ data: { id: item.id, status, admin_response: response || null } }),
    onSuccess: () => {
      toast.success("עודכן");
      qc.invalidateQueries({ queryKey: ["admin-inbox"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="rounded-2xl border border-border/70 bg-card/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gold/10 px-2 py-0.5 text-xs font-bold text-gold">
            {TYPE_LABEL[item.type]}
          </span>
          <span className="font-bold">{item.title}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {item.author?.full_name || item.author?.email || "?"} · {timeAgo(item.created_at)}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm">{item.content}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_auto]">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">פתוח</SelectItem>
            <SelectItem value="in_review">בבדיקה</SelectItem>
            <SelectItem value="resolved">טופל</SelectItem>
          </SelectContent>
        </Select>
        <Textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="תגובת ההנהלה (תוצג לסטודנט)"
          rows={2}
          maxLength={2000}
        />
        <Button onClick={() => m.mutate()} disabled={m.isPending} className="bg-gradient-to-r from-gold to-amber-600 text-gold-foreground">
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "שמור"}
        </Button>
      </div>
    </div>
  );
}

function ContactList({ items }: { items: any[] }) {
  const roots = items.filter((i) => !i.parent_id);
  if (roots.length === 0) return <EmptyAdmin icon={Inbox} text="אין פניות." />;
  return (
    <>
      {roots.map((r) => (
        <ContactThread key={r.id} root={r} replies={items.filter((i) => i.parent_id === r.id)} />
      ))}
    </>
  );
}

function ContactThread({ root, replies }: { root: any; replies: any[] }) {
  const qc = useQueryClient();
  const reply = useServerFn(replyToContact);
  const markRead = useServerFn(markContactRead);
  const [text, setText] = useState("");
  const m = useMutation({
    mutationFn: () => reply({ data: { parent_id: root.id, content: text } }),
    onSuccess: () => {
      toast.success("התגובה נשלחה");
      setText("");
      qc.invalidateQueries({ queryKey: ["admin-inbox"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="rounded-2xl border border-border/70 bg-card/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gold/10 px-2 py-0.5 text-xs font-bold text-gold">
            {ROLE_LABEL[root.recipient_role]}
          </span>
          <span className="font-bold">{root.subject}</span>
          {!root.is_read && (
            <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300">
              חדש
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {root.sender?.full_name || root.sender?.email || "?"} · {timeAgo(root.created_at)}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm">{root.content}</p>
      {replies.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
          {replies.map((r) => (
            <div key={r.id} className="rounded-lg bg-gold/5 p-2 text-xs">
              <div className="mb-0.5 font-bold text-gold">
                תגובה · {timeAgo(r.created_at)}
              </div>
              <p className="whitespace-pre-wrap">{r.content}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="כתוב תשובה לסטודנט…"
          rows={2}
          maxLength={2000}
          className="flex-1"
        />
        <div className="flex gap-2">
          {!root.is_read && (
            <Button
              variant="outline"
              onClick={() =>
                markRead({ data: { id: root.id } }).then(() => {
                  toast.success("סומן כנקרא");
                  qc.invalidateQueries({ queryKey: ["admin-inbox"] });
                })
              }
            >
              סמן כנקרא
            </Button>
          )}
          <Button
            onClick={() => m.mutate()}
            disabled={!text.trim() || m.isPending}
            className="bg-gradient-to-r from-gold to-amber-600 text-gold-foreground"
          >
            <Send className="me-2 h-4 w-4" />
            שלח
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyAdmin({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border/60 bg-card/30 p-10 text-muted-foreground">
      <Icon className="mb-3 h-8 w-8" />
      <span className="text-sm">{text}</span>
    </div>
  );
}
