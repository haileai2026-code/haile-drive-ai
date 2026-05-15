## תוכנית: ניקוי נתוני דמו + ביקורת אבטחה

### חלק 1 — ניקוי כל נתוני הדמו

**קבצים שמכילים נתונים מדומים (יוסרו / יוחלפו):**

1. `src/lib/mock-data.ts` — מכיל `lessons[]` ו-`sampleQuestions[]` קשיחים.
   - **פעולה:** למחוק את כל המערכים. להשאיר רק את הטיפוסים (`Lesson`, `QuizQuestion`, `Localized`) כי הם בשימוש על ידי הקוד.
   - להשאיר ייצוא של מערכים ריקים (`export const lessons: Lesson[] = []`) כדי לא לשבור imports.

2. `src/lib/ops-data.ts` — מכיל `staff`, `classes`, `candidates`, `attendanceToday`, `makeupQueue`, `notifications` קשיחים.
   - **פעולה:** למחוק את כל ה-seeds. להשאיר טיפוסים + helpers (cityName/className/teacherName יחזירו את ה-id אם אין match).
   - מערכי seed יהפכו למערכים ריקים.

3. `src/lib/data-store.tsx` — `localStorage` store עם `seedCities`, `seedBranches`, `seedCandidates`.
   - **פעולה:** לרוקן את ה-seeds. ה-store עדיין יעבוד אבל יתחיל ריק.
   - להוסיף ניקוי חד פעמי של `localStorage["hda.store.v1"]` הישן (גרסה v2) כדי שמשתמשים שכבר טענו את ה-demo יקבלו state נקי.

4. **דפים שמשתמשים ב-mock data — יוחלפו ל-Supabase או למצב ריק:**

   - `src/routes/dashboard.tsx` — משתמש ב-`lessonCatalog` (מ-mock-data) להצגת "המשך בשיעור" ו"שיעורים".
     - **פעולה:** להחליף ל-query מטבלת `materials` (הקטגוריה study) או להציג empty-state אם אין חומרים. ה-`lesson-progress` (localStorage) יישאר אבל לא יציג כלום אם אין שיעורים.
   - `src/routes/lessons.$lessonId.tsx` — מציג שיעור מתוך `lessons[]`.
     - **פעולה:** להחליף לטעינה מטבלת `materials` לפי id, ואם לא נמצא — empty state ידידותי.
   - `src/routes/admin.lessons.tsx` — מציג רשימת `lessons` קשיחה.
     - **פעולה:** להחליף ל-query על `materials` (קטגוריה study) או להפנות לדף `/admin/materials` שכבר קיים.
   - `src/routes/quiz.tsx` — `sampleQuestions` קשיח.
     - **פעולה:** להחליף לטעינת בחינה אמיתית מטבלת `exams` + `exam_questions` + `exam_options` (לפי exam_id ב-URL או "המבחן הזמין הראשון"). אם אין בחינות — empty state.
   - `src/routes/admin.staff.tsx` — `staff[]` קשיח.
     - **פעולה:** להחליף ל-query על `profiles + user_roles`. כבר יש `/admin/users` ו-`/admin/teachers` שעושים את זה — דף זה יהפוך ל-redirect או יציג רשימה אמיתית של teachers/staff.
   - `src/routes/admin.import.tsx` ו-`src/routes/admin.export.tsx` — משתמשים ב-`useStore()` ובטיפוסי ops-data. יישארו פונקציונליים (import לתוך data-store) אבל יתחילו ריקים.
   - `src/routes/admin.branches.tsx` — מבוסס על data-store. יישאר אבל יתחיל ריק.

5. **סדר פעולות לאחר הניקוי — לוודא שאין import שבור:**
   - לרוץ TypeScript build
   - לבדוק שכל route נטען

### חלק 2 — ביקורת אבטחה (Security Audit)

**א. RLS על כל הטבלאות**
   - בדקתי: כל 17 הטבלאות ב-Supabase (`candidates`, `classes`, `cities`, `materials`, `exams`, `exam_questions`, `exam_options`, `exam_results`, `attendance_records`, `makeup_assignments`, `notifications`, `schedule_events`, `teacher_assignments`, `profiles`, `user_roles`, `beqa_diagnostic_sessions`, `raw_biometric_log`, `candidate_documents`) — כולן עם RLS מופעל ועם policies סבירים.
   - **תיקון יחיד נדרש:** ה-linter מצא warning שיש extension ב-`public` schema (לא קריטי ל-RLS, רק best practice).

**ב. בידוד סטודנטים**
   - `candidates` — סטודנט רואה רק את הרשומה שלו (לפי email).
   - `attendance_records`, `makeup_assignments`, `notifications`, `schedule_events`, `exam_results`, `beqa_diagnostic_sessions`, `raw_biometric_log` — סטודנט רואה רק את עצמו.
   - **כולם תקינים** — אין דליפת מידע בין סטודנטים.

**ג. בידוד פאנל בעלים/מורה**
   - כל פעולת write (insert/update/delete) על טבלאות מנהל דורשת `has_role(auth.uid(), 'owner')` — סטודנט לא יכול לכתוב.
   - הראוטים מוגנים ע"י `RequireAuth roles={["owner"]}` בצד הלקוח — **זו הגנה UX בלבד**, האכיפה האמיתית היא ב-RLS שכבר מוגדר.
   - **תקין.**

**ד. סודות בקוד הקדמי**
   - חיפוש אחר `process.env` ב-`src/`: כל המופעים נמצאים ב-`*.functions.ts` (server functions בלבד) — `ai-chat.functions.ts`, `notifications.functions.ts`. אף סוד לא דולף ל-bundle של הדפדפן.
   - `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` בלבד נחשפים — וזה תקין (publishable key).
   - **תקין.**

**ה. אימות API calls**
   - כל ה-server functions הרגישים משתמשים ב-`requireSupabaseAuth` middleware (כפי שראינו ב-knowledge files).
   - ה-route `api/public/hooks/notifications-tick.ts` הוא public (cron) — ייבדק שיש לו signature/secret.

**ו. שינויים אקטיביים שאעשה (Audit + Fix):**
   1. להריץ `security--run_security_scan` ולתקן ממצאים קריטיים.
   2. לוודא ש-`api/public/hooks/notifications-tick` דורש secret header (אם לא — להוסיף).
   3. להעביר את ה-extension מ-`public` schema (warning של ה-linter) — אם בטוח לעשות זאת.

### תוצרים סופיים

- אפליקציה מתחילה במצב ריק לחלוטין מול Supabase. אין יותר "Student #1", "Air Brake Basics", או "Mekdes" מופיעים בשום מקום.
- דשבורד / שיעורים / מבחנים מציגים empty states ידידותיים בעברית עד שבעלים מכניס תוכן אמיתי.
- דוח אבטחה קצר עם הממצאים והתיקונים.

### היקף

~10 קבצים יערכו, 1 migration אופציונלי (extension move). אין שינויים בסכמה.

**אשר ואני אתחיל. אם תרצה לדלג על משהו (למשל לא לגעת ב-quiz ולתת לו להישאר עם ה-sample questions לבדיקות) — תגיד.**