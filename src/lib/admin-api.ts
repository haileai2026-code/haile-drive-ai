import { supabase } from "@/integrations/supabase/client";

// Lightweight typed helpers for the new admin tables.
// Casting through `any` because Database types regenerate after migration apply.
const sb = supabase as any;

export type City = { id: string; name: string; name_he: string | null };
export type ClassRow = {
  id: string;
  name: string;
  city_id: string | null;
  teacher_id: string | null;
  schedule: string | null;
  capacity: number;
};
export type Candidate = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  city_id: string | null;
  class_id: string | null;
  assigned_teacher_id: string | null;
  language: string | null;
  status: string;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
};
export type Material = {
  id: string;
  title: string;
  description: string | null;
  category: "study" | "enrichment";
  type: "pdf" | "image" | "link" | "video";
  file_url: string | null;
  external_link: string | null;
  class_id: string | null;
  created_at: string;
};
export type Exam = {
  id: string;
  title: string;
  description: string | null;
  class_id: string | null;
  is_published: boolean;
  created_at: string;
};
export type ExamQuestion = {
  id: string;
  exam_id: string;
  question_text: string;
  image_url: string | null;
  order_index: number;
};
export type ExamOption = {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  order_index: number;
};

export const adminApi = {
  // CITIES
  async listCities(): Promise<City[]> {
    const { data, error } = await sb.from("cities").select("*").order("name_he");
    if (error) throw error;
    return data ?? [];
  },
  async upsertCity(c: Partial<City> & { name: string }) {
    const { error } = await sb.from("cities").upsert(c);
    if (error) throw error;
  },
  async deleteCity(id: string) {
    const { error } = await sb.from("cities").delete().eq("id", id);
    if (error) throw error;
  },

  // CLASSES
  async listClasses(): Promise<ClassRow[]> {
    const { data, error } = await sb.from("classes").select("*").order("name");
    if (error) throw error;
    return data ?? [];
  },
  async upsertClass(c: Partial<ClassRow> & { name: string }) {
    const { error } = await sb.from("classes").upsert(c);
    if (error) throw error;
  },
  async deleteClass(id: string) {
    const { error } = await sb.from("classes").delete().eq("id", id);
    if (error) throw error;
  },

  // CANDIDATES
  async listCandidates(opts?: { teacherId?: string }): Promise<Candidate[]> {
    let q = sb.from("candidates").select("*").order("created_at", { ascending: false });
    if (opts?.teacherId) q = q.eq("assigned_teacher_id", opts.teacherId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },
  async upsertCandidate(c: Partial<Candidate> & { full_name: string }) {
    const { error } = await sb.from("candidates").upsert(c);
    if (error) throw error;
  },
  async deleteCandidate(id: string) {
    const { error } = await sb.from("candidates").delete().eq("id", id);
    if (error) throw error;
  },

  // TEACHERS — list profiles that have the 'teacher' role
  async listTeachers(): Promise<{ id: string; full_name: string | null; email: string | null }[]> {
    const { data: roleRows, error: rolesErr } = await sb
      .from("user_roles")
      .select("user_id")
      .eq("role", "teacher");
    if (rolesErr) throw rolesErr;
    const ids = (roleRows ?? []).map((r: any) => r.user_id);
    if (!ids.length) return [];
    const { data, error } = await sb.from("profiles").select("id,full_name,email").in("id", ids);
    if (error) throw error;
    return data ?? [];
  },
  async listAllUsers(): Promise<{ id: string; full_name: string | null; email: string | null }[]> {
    const { data, error } = await sb.from("profiles").select("id,full_name,email").order("full_name");
    if (error) throw error;
    return data ?? [];
  },
  async setUserRole(userId: string, role: "owner" | "staff" | "teacher" | "student", enabled: boolean) {
    if (enabled) {
      const { error } = await sb.from("user_roles").insert({ user_id: userId, role });
      if (error && !String(error.message).includes("duplicate")) throw error;
    } else {
      const { error } = await sb.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) throw error;
    }
  },

  // MATERIALS
  async listMaterials(category?: "study" | "enrichment"): Promise<Material[]> {
    let q = sb.from("materials").select("*").order("created_at", { ascending: false });
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },
  async upsertMaterial(m: Partial<Material> & { title: string; category: "study" | "enrichment"; type: Material["type"] }) {
    const { error } = await sb.from("materials").upsert(m);
    if (error) throw error;
  },
  async deleteMaterial(id: string) {
    const { error } = await sb.from("materials").delete().eq("id", id);
    if (error) throw error;
  },
  async uploadMaterialFile(file: File): Promise<string> {
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from("materials").upload(path, file, { upsert: false });
    if (error) throw error;
    const { data } = sb.storage.from("materials").getPublicUrl(path);
    return data.publicUrl;
  },

  // EXAMS
  async listExams(): Promise<Exam[]> {
    const { data, error } = await sb.from("exams").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async getExam(id: string): Promise<Exam | null> {
    const { data, error } = await sb.from("exams").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async upsertExam(e: Partial<Exam> & { title: string }) {
    const { data, error } = await sb.from("exams").upsert(e).select().single();
    if (error) throw error;
    return data as Exam;
  },
  async deleteExam(id: string) {
    const { error } = await sb.from("exams").delete().eq("id", id);
    if (error) throw error;
  },
  async listQuestions(examId: string): Promise<(ExamQuestion & { options: ExamOption[] })[]> {
    const { data: qs, error } = await sb
      .from("exam_questions")
      .select("*, options:exam_options(*)")
      .eq("exam_id", examId)
      .order("order_index");
    if (error) throw error;
    return (qs ?? []).map((q: any) => ({
      ...q,
      options: (q.options ?? []).sort((a: any, b: any) => a.order_index - b.order_index),
    }));
  },
  async createQuestion(input: {
    exam_id: string;
    question_text: string;
    image_url?: string | null;
    order_index: number;
    options: { option_text: string; is_correct: boolean }[];
  }) {
    const { data: q, error } = await sb
      .from("exam_questions")
      .insert({
        exam_id: input.exam_id,
        question_text: input.question_text,
        image_url: input.image_url ?? null,
        order_index: input.order_index,
      })
      .select()
      .single();
    if (error) throw error;
    const opts = input.options.map((o, i) => ({
      question_id: q.id,
      option_text: o.option_text,
      is_correct: o.is_correct,
      order_index: i,
    }));
    const { error: oerr } = await sb.from("exam_options").insert(opts);
    if (oerr) throw oerr;
  },
  async deleteQuestion(id: string) {
    const { error } = await sb.from("exam_questions").delete().eq("id", id);
    if (error) throw error;
  },

  // ATTENDANCE
  async listAttendance(opts?: { classId?: string; date?: string; from?: string; to?: string }): Promise<AttendanceRecord[]> {
    let q = sb.from("attendance_records").select("*").order("lesson_date", { ascending: false });
    if (opts?.classId) q = q.eq("class_id", opts.classId);
    if (opts?.date) q = q.eq("lesson_date", opts.date);
    if (opts?.from) q = q.gte("lesson_date", opts.from);
    if (opts?.to) q = q.lte("lesson_date", opts.to);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },
  async upsertAttendance(rows: Partial<AttendanceRecord>[]) {
    if (!rows.length) return;
    const { error } = await sb.from("attendance_records").upsert(rows, { onConflict: "class_id,candidate_id,lesson_date" });
    if (error) throw error;
  },

  // MAKEUP ASSIGNMENTS
  async listMakeup(opts?: { status?: MakeupStatus }): Promise<MakeupAssignment[]> {
    let q = sb.from("makeup_assignments").select("*").order("created_at", { ascending: false });
    if (opts?.status) q = q.eq("status", opts.status);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },
  async assignMakeup(id: string, target_class_id: string, target_date: string, notes?: string) {
    const { error } = await sb.from("makeup_assignments").update({
      target_class_id, target_date, notes: notes ?? null, status: "scheduled",
    }).eq("id", id);
    if (error) throw error;
  },
  async setMakeupStatus(id: string, status: MakeupStatus) {
    const { error } = await sb.from("makeup_assignments").update({ status }).eq("id", id);
    if (error) throw error;
  },
};

export type ScheduleEventType = "lesson" | "exam" | "makeup";
export type ScheduleEvent = {
  id: string;
  type: ScheduleEventType;
  title: string;
  class_id: string | null;
  exam_id: string | null;
  candidate_id: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const scheduleApi = {
  async list(opts?: { classId?: string; from?: string; to?: string }): Promise<ScheduleEvent[]> {
    let q = (supabase as any).from("schedule_events").select("*").order("event_date").order("start_time");
    if (opts?.classId) q = q.eq("class_id", opts.classId);
    if (opts?.from) q = q.gte("event_date", opts.from);
    if (opts?.to) q = q.lte("event_date", opts.to);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },
  async upsert(e: Partial<ScheduleEvent> & { title: string; event_date: string; type: ScheduleEventType }) {
    const { error } = await (supabase as any).from("schedule_events").upsert(e);
    if (error) throw error;
  },
  async remove(id: string) {
    const { error } = await (supabase as any).from("schedule_events").delete().eq("id", id);
    if (error) throw error;
  },
  async bulkCreate(events: Array<Partial<ScheduleEvent> & { title: string; event_date: string; type: ScheduleEventType }>) {
    if (!events.length) return { inserted: 0 };
    const { error } = await (supabase as any).from("schedule_events").insert(events);
    if (error) throw error;
    return { inserted: events.length };
  },
  async findConflicts(candidates: Array<{ event_date: string; start_time: string | null; end_time: string | null; class_id: string | null; location: string | null }>) {
    if (!candidates.length) return [];
    const dates = Array.from(new Set(candidates.map((c) => c.event_date)));
    const { data, error } = await (supabase as any)
      .from("schedule_events")
      .select("id,event_date,start_time,end_time,class_id,location,title")
      .in("event_date", dates);
    if (error) throw error;
    const existing: Array<{ id: string; event_date: string; start_time: string | null; end_time: string | null; class_id: string | null; location: string | null; title: string }> = data ?? [];
    const overlap = (aStart: string | null, aEnd: string | null, bStart: string | null, bEnd: string | null) => {
      if (!aStart || !aEnd || !bStart || !bEnd) return aStart === bStart;
      return aStart < bEnd && bStart < aEnd;
    };
    const conflicts: Array<{ candidate: typeof candidates[number]; with: typeof existing[number] }> = [];
    candidates.forEach((c) => {
      existing.forEach((e) => {
        if (e.event_date !== c.event_date) return;
        const sameClass = c.class_id && e.class_id === c.class_id;
        const sameLoc = c.location && e.location === c.location;
        if (!sameClass && !sameLoc) return;
        if (overlap(c.start_time, c.end_time, e.start_time, e.end_time)) {
          conflicts.push({ candidate: c, with: e });
        }
      });
    });
    return conflicts;
  },
};

export type CandidateDocument = {
  id: string;
  candidate_id: string;
  label: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export const docsApi = {
  async list(candidateId: string): Promise<CandidateDocument[]> {
    const { data, error } = await (supabase as any)
      .from("candidate_documents")
      .select("*")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async upload(candidateId: string, label: string, file: File): Promise<void> {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${candidateId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await (supabase as any).storage
      .from("candidate-documents")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (upErr) throw upErr;
    const { error: insErr } = await (supabase as any).from("candidate_documents").insert({
      candidate_id: candidateId,
      label,
      file_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
    });
    if (insErr) throw insErr;
  },
  async signedUrl(path: string, expiresIn = 300): Promise<string> {
    const { data, error } = await (supabase as any).storage
      .from("candidate-documents")
      .createSignedUrl(path, expiresIn);
    if (error) throw error;
    return data.signedUrl as string;
  },
  async remove(doc: CandidateDocument): Promise<void> {
    await (supabase as any).storage.from("candidate-documents").remove([doc.file_path]);
    const { error } = await (supabase as any).from("candidate_documents").delete().eq("id", doc.id);
    if (error) throw error;
  },
  async rename(id: string, label: string): Promise<void> {
    const { error } = await (supabase as any).from("candidate_documents").update({ label }).eq("id", id);
    if (error) throw error;
  },
};

export type MakeupStatus = "pending" | "scheduled" | "completed" | "cancelled";
export type MakeupAssignment = {
  id: string;
  candidate_id: string;
  source_attendance_id: string | null;
  source_class_id: string;
  source_date: string;
  target_class_id: string | null;
  target_date: string | null;
  status: MakeupStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationChannel = "sms" | "whatsapp";
export type NotificationStatus = "pending" | "sent" | "failed" | "cancelled";
export type NotificationRow = {
  id: string;
  candidate_id: string | null;
  event_id: string | null;
  channel: NotificationChannel;
  to_phone: string;
  message: string;
  language: string;
  status: NotificationStatus;
  scheduled_at: string;
  sent_at: string | null;
  provider_sid: string | null;
  error: string | null;
  created_at: string;
};

export const notificationsApi = {
  async list(): Promise<NotificationRow[]> {
    const { data, error } = await sb
      .from("notifications")
      .select("*")
      .order("scheduled_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  },
  async insertMany(rows: Partial<NotificationRow>[]) {
    const { error } = await sb.from("notifications").insert(rows);
    if (error) throw error;
  },
  async cancel(id: string) {
    const { error } = await sb.from("notifications").update({ status: "cancelled" }).eq("id", id);
    if (error) throw error;
  },
  async remove(id: string) {
    const { error } = await sb.from("notifications").delete().eq("id", id);
    if (error) throw error;
  },
};

export type AttendanceMark = "present" | "late" | "missing" | "makeup_completed";
export type AttendanceRecord = {
  id: string;
  class_id: string;
  candidate_id: string;
  lesson_date: string;
  mark: AttendanceMark;
  notes: string | null;
  marked_by: string | null;
  created_at: string;
};
