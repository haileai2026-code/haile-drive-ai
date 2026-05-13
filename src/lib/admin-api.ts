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
};
