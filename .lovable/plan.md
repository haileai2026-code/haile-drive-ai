## Owner Dashboard — Full Implementation Plan

This is a large build (5 feature areas + database + RLS). I'll implement it in phases so we can validate each piece works before piling on the next.

### Phase 1 — Database foundation (one migration)

New tables in Supabase, all with RLS:

- **`cities`** — `name`, `name_he`. Owner CRUD, everyone authenticated reads.
- **`classes`** — `name`, `city_id`, `teacher_id` (nullable, FK profiles). Owner CRUD, teachers read their own, students read their assigned class.
- **`candidates`** — `full_name`, `phone`, `email`, `city_id`, `class_id` (nullable), `language`, `status` (enum: new_lead, contacted, missing_docs, assigned, active, completed), `notes`, `assigned_teacher_id`. Owner full CRUD; teachers read where `assigned_teacher_id = auth.uid()`.
- **`teacher_assignments`** — `teacher_id`, `city_id`, `class_id`. Owner CRUD; teacher reads own.
- **`materials`** — `title`, `description`, `category` (enum: study, enrichment), `type` (pdf/image/link), `file_url`, `external_link`, `class_id` (nullable = global). Owner CRUD; teachers + students read.
- **`exams`** — `title`, `description`, `class_id` (nullable), `created_by`, `is_published`.
- **`exam_questions`** — `exam_id`, `question_text`, `image_url`, `order_index`.
- **`exam_options`** — `question_id`, `option_text`, `is_correct`.

Storage bucket: **`materials`** (public read, owner write) for PDFs/images.

Helper trigger: auto-set `assigned_teacher_id` on candidates from `classes.teacher_id` when a class is assigned.

### Phase 2 — Owner UI: Candidates CRM

Replace mock-data version of `src/routes/admin.candidates.tsx` with live Supabase queries. Add:
- Add / Edit dialog (form with name, phone, email, city dropdown, class dropdown, language, status, notes)
- Delete with confirmation
- Inline city + class assignment from row
- Filters by city, class, status (already in UI — wire to real data)

### Phase 3 — Teachers & Class Assignment

New route `src/routes/admin.teachers.tsx`:
- List all users with `teacher` role from `user_roles` + `profiles`
- Assign cities/classes to a teacher (multi-select)
- "Promote to teacher" button (creates row in `user_roles`)

Update `src/routes/admin.classes.tsx` to manage classes + assign teacher per class.

### Phase 4 — Teacher view filtering

Update `src/routes/teacher.tsx` to load only candidates where `assigned_teacher_id = current user id`. RLS enforces this on the backend too.

### Phase 5 — Content Management (Materials)

New route `src/routes/admin.materials.tsx`:
- List/grid of materials with category filter (Study / Enrichment)
- Upload dialog: title, description, category, type, file upload (to `materials` bucket) OR external link, optional class assignment
- Edit / Delete

Student-facing `src/routes/lessons.tsx` reads from same table.

### Phase 6 — Exam Creator

New route `src/routes/admin.exams.tsx`:
- List exams with create/edit/delete
- Exam editor `src/routes/admin.exams.$examId.tsx`:
  - Question list with add/edit/delete
  - Per question: text, optional image upload, 2–6 options, mark correct one
  - Assign exam to class dropdown, publish toggle

Reuse existing `src/routes/quiz.tsx` to render published exams to students.

### Technical details

- All mutations via **`createServerFn`** with `requireSupabaseAuth` middleware so RLS runs as the owner. Owner-only writes enforced via `has_role(auth.uid(), 'owner')` check inside RLS policies.
- Use `@tanstack/react-query` for data fetching + cache invalidation after mutations.
- Forms: react-hook-form + zod (already in project).
- File uploads: `supabase.storage.from('materials').upload(...)` directly from client (RLS on storage bucket controls access).
- All UI in Hebrew with RTL, matching existing AdminShell style.

### Scope confirmation

This is roughly **8–12 new/edited files + 1 large migration + 1 storage bucket**. I'll do it in one pass but commit logically by phase so you can test as we go.

**Confirm and I'll start with Phase 1 (database migration).** If you want to trim scope (e.g. skip exam creator for now), tell me which phases to drop.