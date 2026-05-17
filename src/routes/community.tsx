import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  MessageSquare,
  Megaphone,
  Star,
  Mail,
  Send,
  Image as ImageIcon,
  Bug,
  Lightbulb,
  Frown,
  ThumbsUp,
  Loader2,
  GraduationCap,
  Building2,
  ClipboardList,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  listFeedPosts,
  createPost,
  listComments,
  addComment,
  submitFeedback,
  myFeedback,
  sendContactMessage,
  myContactThreads,
} from "@/lib/community.functions";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "קהילה — Haile Drive AI" },
      { name: "description", content: "פורטל קהילה לסטודנטים — פוסטים, הודעות, משוב ופניות." },
    ],
  }),
  component: CommunityPage,
});

// ---------- Bilingual helper ----------
function bi(he: string, am: string) {
  return (
    <span className="leading-tight">
      <span className="block font-semibold">{he}</span>
      <span className="block text-[11px] text-muted-foreground">{am}</span>
    </span>
  );
}

const T = {
  title: ["פורטל קהילה", "የማህበረሰብ መግቢያ"],
  tabFeed: ["💬 קהילה", "💬 ማህበረሰብ"],
  tabBoard: ["📢 לוח מודעות", "📢 ማስታወቂያዎች"],
  tabFeedback: ["⭐ משוב", "⭐ አስተያየት"],
  tabContact: ["📩 פנה אלינו", "📩 አግኙን"],
  newPost: ["פוסט חדש", "አዲስ ልጥፍ"],
  postPlaceholder: ["מה תרצה לשתף עם הכיתה?", "ለክፍሉ ምን ማካፈል ይፈልጋሉ?"],
  attachImage: ["צרף תמונה", "ምስል አያይዝ"],
  publish: ["פרסם", "ለጥፍ"],
  emptyFeed: ["אין עדיין פוסטים בכיתה. תהיה הראשון!", "በክፍሉ ውስጥ ገና ምንም ልጥፍ የለም። የመጀመሪያው ይሁኑ!"],
  emptyBoard: ["אין הודעות מההנהלה כרגע.", "በአሁኑ ጊዜ ከአስተዳደር ምንም ማስታወቂያ የለም።"],
  loadComments: ["הצג תגובות", "አስተያየቶች"],
  commentPlaceholder: ["כתוב תגובה…", "አስተያየት ይጻፉ…"],
  send: ["שלח", "ላክ"],
  feedbackTitle: ["כותרת קצרה", "አጭር ርዕስ"],
  feedbackContent: ["תאר בפירוט", "በዝርዝር ይግለጹ"],
  feedbackSubmit: ["שלח משוב", "አስተያየት ላክ"],
  feedbackThanks: ["תודה! קיבלנו ונבדוק", "አመሰግናለሁ! ተቀብለን እንመለከታለን"],
  myFeedback: ["המשובים שלי", "የእኔ አስተያየቶች"],
  contactSubject: ["נושא", "ርዕስ"],
  contactBody: ["תוכן הפנייה", "የመልዕክት ይዘት"],
  contactSend: ["שלח פנייה", "መልዕክት ላክ"],
  contactSent: ["הפנייה נשלחה. נחזור אליך בקרוב.", "መልዕክቱ ተልኳል። በቅርቡ እንመለስልዎታለን።"],
  myThreads: ["שיחות קודמות שלי", "ቀደም ያሉ ውይይቶቼ"],
  noThreads: ["עדיין לא שלחת שום פנייה.", "እስካሁን ምንም መልዕክት አልላኩም።"],
};

function statusLabel(s: string) {
  if (s === "open") return ["פתוח", "ክፍት"];
  if (s === "in_review") return ["בבדיקה", "በመገምገም ላይ"];
  return ["טופל", "ተፈትቷል"];
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "כעת";
  if (m < 60) return `${m} ד׳`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ש׳`;
  return `${Math.floor(h / 24)} י׳`;
}

function initials(name?: string | null, email?: string | null) {
  const s = (name || email || "?").trim();
  return s.slice(0, 2).toUpperCase();
}

// ---------- Page ----------
function CommunityPage() {
  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-2xl font-black tracking-tight text-gold">{T.title[0]}</h1>
        <p className="text-sm text-muted-foreground">{T.title[1]}</p>
      </div>

      <Tabs defaultValue="feed" dir="rtl" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-card/60">
          <TabsTrigger value="feed" className="data-[state=active]:bg-gold/20 data-[state=active]:text-gold text-[11px] sm:text-xs">
            {T.tabFeed[0]}
          </TabsTrigger>
          <TabsTrigger value="board" className="data-[state=active]:bg-gold/20 data-[state=active]:text-gold text-[11px] sm:text-xs">
            {T.tabBoard[0]}
          </TabsTrigger>
          <TabsTrigger value="feedback" className="data-[state=active]:bg-gold/20 data-[state=active]:text-gold text-[11px] sm:text-xs">
            {T.tabFeedback[0]}
          </TabsTrigger>
          <TabsTrigger value="contact" className="data-[state=active]:bg-gold/20 data-[state=active]:text-gold text-[11px] sm:text-xs">
            {T.tabContact[0]}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="mt-4">
          <FeedTab />
        </TabsContent>
        <TabsContent value="board" className="mt-4">
          <BoardTab />
        </TabsContent>
        <TabsContent value="feedback" className="mt-4">
          <FeedbackTab />
        </TabsContent>
        <TabsContent value="contact" className="mt-4">
          <ContactTab />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

// ---------- Tab 1: Feed ----------
function FeedTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchPosts = useServerFn(listFeedPosts);
  const { data: posts, isLoading } = useQuery({
    queryKey: ["community-posts"],
    queryFn: () => fetchPosts(),
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("community_posts_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, () => {
        qc.invalidateQueries({ queryKey: ["community-posts"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "community_comments" }, (payload: any) => {
        const pid = payload?.new?.post_id ?? payload?.old?.post_id;
        if (pid) qc.invalidateQueries({ queryKey: ["community-comments", pid] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const visible = useMemo(
    () => (posts ?? []).filter((p: any) => p.post_type !== "announcement"),
    [posts],
  );

  return (
    <div className="space-y-4">
      <NewPostCard userId={user?.id} />
      {isLoading ? (
        <div className="grid place-items-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-gold" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState icon={MessageSquare} he={T.emptyFeed[0]} am={T.emptyFeed[1]} />
      ) : (
        <ul className="space-y-3">
          {visible.map((p: any) => (
            <PostCard key={p.id} post={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NewPostCard({ userId }: { userId?: string }) {
  const qc = useQueryClient();
  const create = useServerFn(createPost);
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("community-media").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("community-media").getPublicUrl(path);
      setMediaUrl(data.publicUrl);
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function onSubmit() {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await create({ data: { content: content.trim(), post_type: "post", media_url: mediaUrl } });
      setContent("");
      setMediaUrl(null);
      qc.invalidateQueries({ queryKey: ["community-posts"] });
    } catch (err: any) {
      toast.error(err.message ?? "שגיאה בפרסום");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gold">
        <MessageSquare className="h-4 w-4" />
        {T.newPost[0]} <span className="text-muted-foreground text-xs">/ {T.newPost[1]}</span>
      </div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={`${T.postPlaceholder[0]}  ·  ${T.postPlaceholder[1]}`}
        rows={3}
        className="resize-none bg-background/60"
        maxLength={2000}
      />
      {mediaUrl && (
        <div className="relative mt-3 inline-block">
          <img src={mediaUrl} alt="" className="max-h-40 rounded-lg border border-border/60" />
          <button
            onClick={() => setMediaUrl(null)}
            className="absolute -end-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-rose-500 text-white shadow"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-gold">
          <ImageIcon className="h-4 w-4" />
          {uploading ? "..." : T.attachImage[0]}
          <input type="file" accept="image/*" className="hidden" onChange={onPickFile} disabled={uploading} />
        </label>
        <Button
          onClick={onSubmit}
          disabled={!content.trim() || submitting || uploading}
          className="bg-gradient-to-r from-gold to-amber-600 text-gold-foreground"
        >
          <Send className="me-2 h-4 w-4" />
          {T.publish[0]}
        </Button>
      </div>
    </div>
  );
}

function PostCard({ post }: { post: any }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-2xl border border-border/70 bg-card/50 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/15 text-xs font-bold text-gold">
          {initials(post.author?.full_name, post.author?.email)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold">{post.author?.full_name || post.author?.email || "אנונימי"}</span>
            {post.post_type === "question" && (
              <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] text-blue-300">שאלה</span>
            )}
            <span className="text-muted-foreground">· {timeAgo(post.created_at)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{post.content}</p>
          {post.media_url && (
            <img src={post.media_url} alt="" className="mt-3 max-h-72 rounded-xl border border-border/60" />
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="mt-3 text-xs text-muted-foreground hover:text-gold"
          >
            {T.loadComments[0]} / {T.loadComments[1]}
          </button>
          {open && <CommentSection postId={post.id} />}
        </div>
      </div>
    </li>
  );
}

function CommentSection({ postId }: { postId: string }) {
  const qc = useQueryClient();
  const fetchC = useServerFn(listComments);
  const add = useServerFn(addComment);
  const [text, setText] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["community-comments", postId],
    queryFn: () => fetchC({ data: { post_id: postId } }),
  });
  async function onAdd() {
    if (!text.trim()) return;
    try {
      await add({ data: { post_id: postId, content: text.trim() } });
      setText("");
      qc.invalidateQueries({ queryKey: ["community-comments", postId] });
    } catch (err: any) {
      toast.error(err.message);
    }
  }
  return (
    <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-gold" />
      ) : (
        (data ?? []).map((c: any) => (
          <div key={c.id} className="flex items-start gap-2 text-xs">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold/10 text-[10px] font-bold text-gold">
              {initials(c.author?.full_name, c.author?.email)}
            </span>
            <div className="min-w-0 flex-1 rounded-lg bg-background/50 px-3 py-1.5">
              <div className="flex items-center gap-1">
                <span className="font-semibold">{c.author?.full_name || c.author?.email || "אנונימי"}</span>
                <span className="text-muted-foreground">· {timeAgo(c.created_at)}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap">{c.content}</p>
            </div>
          </div>
        ))
      )}
      <div className="flex items-center gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={T.commentPlaceholder[0]}
          maxLength={1000}
          className="h-8 text-xs"
        />
        <Button size="sm" onClick={onAdd} disabled={!text.trim()}>
          <Send className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ---------- Tab 2: Board ----------
function BoardTab() {
  const fetchPosts = useServerFn(listFeedPosts);
  const { data, isLoading } = useQuery({
    queryKey: ["community-posts"],
    queryFn: () => fetchPosts(),
  });
  const announcements = useMemo(
    () => (data ?? []).filter((p: any) => p.post_type === "announcement"),
    [data],
  );
  if (isLoading) {
    return (
      <div className="grid place-items-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-gold" />
      </div>
    );
  }
  if (announcements.length === 0) {
    return <EmptyState icon={Megaphone} he={T.emptyBoard[0]} am={T.emptyBoard[1]} />;
  }
  return (
    <ul className="space-y-3">
      {announcements.map((p: any) => (
        <li
          key={p.id}
          className="rounded-2xl border border-gold/30 bg-gradient-to-br from-amber-900/20 to-card/40 p-4"
        >
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-gold">
            <Megaphone className="h-4 w-4" />
            הודעה רשמית · ኦፊሴላዊ ማስታወቂያ
            <span className="text-muted-foreground font-normal">· {timeAgo(p.created_at)}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{p.content}</p>
          {p.media_url && <img src={p.media_url} alt="" className="mt-3 max-h-72 rounded-xl" />}
          <div className="mt-2 text-[11px] text-muted-foreground">
            — {p.author?.full_name || p.author?.email || "הנהלה"}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------- Tab 3: Feedback ----------
const FEEDBACK_TYPES: Array<{ key: "bug" | "feature" | "complaint" | "compliment"; he: string; am: string; icon: any; tone: string }> = [
  { key: "bug", he: "🐛 תקלה", am: "🐛 ችግር", icon: Bug, tone: "border-rose-500/40 bg-rose-500/10 text-rose-300" },
  { key: "feature", he: "💡 הצעה", am: "💡 ሀሳብ", icon: Lightbulb, tone: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  { key: "complaint", he: "😤 תלונה", am: "😤 ቅሬታ", icon: Frown, tone: "border-orange-500/40 bg-orange-500/10 text-orange-300" },
  { key: "compliment", he: "👏 מחמאה", am: "👏 ምስጋና", icon: ThumbsUp, tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
];

function FeedbackTab() {
  const qc = useQueryClient();
  const submit = useServerFn(submitFeedback);
  const fetchMine = useServerFn(myFeedback);
  const [type, setType] = useState<"bug" | "feature" | "complaint" | "compliment">("bug");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const { data: mine } = useQuery({ queryKey: ["my-feedback"], queryFn: () => fetchMine() });

  const m = useMutation({
    mutationFn: (v: { type: any; title: string; content: string }) => submit({ data: v }),
    onSuccess: () => {
      toast.success(`${T.feedbackThanks[0]} · ${T.feedbackThanks[1]}`);
      setTitle("");
      setContent("");
      qc.invalidateQueries({ queryKey: ["my-feedback"] });
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאה"),
  });

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FEEDBACK_TYPES.map((ft) => {
            const active = type === ft.key;
            const Icon = ft.icon;
            return (
              <button
                key={ft.key}
                onClick={() => setType(ft.key)}
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs transition ${
                  active ? ft.tone + " ring-2 ring-gold/40" : "border-border/60 bg-background/40 text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-semibold">{ft.he}</span>
                <span className="text-[10px] opacity-80">{ft.am}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 space-y-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`${T.feedbackTitle[0]}  ·  ${T.feedbackTitle[1]}`}
            maxLength={200}
          />
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`${T.feedbackContent[0]}  ·  ${T.feedbackContent[1]}`}
            rows={4}
            maxLength={2000}
          />
          <Button
            onClick={() => m.mutate({ type, title, content })}
            disabled={!title.trim() || !content.trim() || m.isPending}
            className="w-full bg-gradient-to-r from-gold to-amber-600 text-gold-foreground"
          >
            {m.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Star className="me-2 h-4 w-4" />}
            {T.feedbackSubmit[0]} · {T.feedbackSubmit[1]}
          </Button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold text-gold">
          {T.myFeedback[0]} <span className="text-muted-foreground font-normal">· {T.myFeedback[1]}</span>
        </h3>
        {(mine ?? []).length === 0 ? (
          <EmptyState icon={Star} he="עדיין לא שלחת משוב." am="እስካሁን አስተያየት አልላኩም።" />
        ) : (
          <ul className="space-y-2">
            {(mine ?? []).map((f: any) => {
              const sl = statusLabel(f.status);
              return (
                <li key={f.id} className="rounded-xl border border-border/60 bg-card/40 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{f.title}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        f.status === "resolved"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : f.status === "in_review"
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-blue-500/15 text-blue-300"
                      }`}
                    >
                      {sl[0]} / {sl[1]}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{f.content}</p>
                  {f.admin_response && (
                    <div className="mt-2 rounded-lg border border-gold/30 bg-gold/5 p-2 text-xs">
                      <div className="mb-1 font-bold text-gold">תגובת ההנהלה · የአስተዳደር ምላሽ</div>
                      <p className="whitespace-pre-wrap">{f.admin_response}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------- Tab 4: Contact ----------
const RECIPIENTS: Array<{ key: "teacher" | "owner" | "secretary"; he: string; am: string; icon: any }> = [
  { key: "teacher", he: "👨‍🏫 מרצה", am: "👨‍🏫 መምህር", icon: GraduationCap },
  { key: "owner", he: "🏢 הנהלה", am: "🏢 አስተዳደር", icon: Building2 },
  { key: "secretary", he: "📋 מזכירה", am: "📋 ጸሐፊ", icon: ClipboardList },
];

function ContactTab() {
  const qc = useQueryClient();
  const send = useServerFn(sendContactMessage);
  const fetchThreads = useServerFn(myContactThreads);
  const [recipient, setRecipient] = useState<"teacher" | "owner" | "secretary">("teacher");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const { data: threads } = useQuery({ queryKey: ["my-contact"], queryFn: () => fetchThreads() });

  const m = useMutation({
    mutationFn: (v: any) => send({ data: v }),
    onSuccess: () => {
      toast.success(`${T.contactSent[0]} · ${T.contactSent[1]}`);
      setSubject("");
      setContent("");
      qc.invalidateQueries({ queryKey: ["my-contact"] });
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאה"),
  });

  // Group threads: roots (no parent_id) + their replies
  const grouped = useMemo(() => {
    const all = threads ?? [];
    const roots = all.filter((t: any) => !t.parent_id);
    return roots.map((r: any) => ({
      ...r,
      replies: all.filter((t: any) => t.parent_id === r.id),
    }));
  }, [threads]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
        <div className="grid grid-cols-3 gap-2">
          {RECIPIENTS.map((r) => {
            const active = recipient === r.key;
            const Icon = r.icon;
            return (
              <button
                key={r.key}
                onClick={() => setRecipient(r.key)}
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs transition ${
                  active
                    ? "border-gold/50 bg-gold/15 text-gold ring-2 ring-gold/40"
                    : "border-border/60 bg-background/40 text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-semibold">{r.he}</span>
                <span className="text-[10px] opacity-80">{r.am}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 space-y-2">
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={`${T.contactSubject[0]}  ·  ${T.contactSubject[1]}`}
            maxLength={200}
          />
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`${T.contactBody[0]}  ·  ${T.contactBody[1]}`}
            rows={4}
            maxLength={2000}
          />
          <Button
            onClick={() => m.mutate({ recipient_role: recipient, subject, content })}
            disabled={!subject.trim() || !content.trim() || m.isPending}
            className="w-full bg-gradient-to-r from-gold to-amber-600 text-gold-foreground"
          >
            {m.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Mail className="me-2 h-4 w-4" />}
            {T.contactSend[0]} · {T.contactSend[1]}
          </Button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold text-gold">
          {T.myThreads[0]} <span className="text-muted-foreground font-normal">· {T.myThreads[1]}</span>
        </h3>
        {grouped.length === 0 ? (
          <EmptyState icon={Mail} he={T.noThreads[0]} am={T.noThreads[1]} />
        ) : (
          <ul className="space-y-2">
            {grouped.map((t: any) => (
              <li key={t.id} className="rounded-xl border border-border/60 bg-card/40 p-3 text-sm">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">{t.subject}</span>
                  <span className="text-muted-foreground">{timeAgo(t.created_at)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{t.content}</p>
                {t.replies.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
                    {t.replies.map((r: any) => (
                      <div key={r.id} className="rounded-lg bg-gold/5 p-2 text-xs">
                        <div className="mb-0.5 font-bold text-gold">תגובה · ምላሽ · {timeAgo(r.created_at)}</div>
                        <p className="whitespace-pre-wrap">{r.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------- Empty state ----------
function EmptyState({ icon: Icon, he, am }: { icon: any; he: string; am: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border/60 bg-card/30 p-10 text-center">
      <Icon className="mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-semibold">{he}</p>
      <p className="mt-1 text-xs text-muted-foreground">{am}</p>
    </div>
  );
}
