
DROP POLICY IF EXISTS "authenticated can read questions" ON public.exam_questions;
DROP POLICY IF EXISTS "owner sees all questions" ON public.exam_questions;

DROP POLICY IF EXISTS "Authenticated read options" ON public.exam_options;
CREATE POLICY "Staff read options"
  ON public.exam_options FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  );

CREATE OR REPLACE FUNCTION public.get_exam_options(p_exam_id uuid)
RETURNS TABLE (id uuid, question_id uuid, option_text text, order_index int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT o.id, o.question_id, o.option_text, o.order_index
  FROM public.exam_options o
  JOIN public.exam_questions q ON q.id = o.question_id
  JOIN public.exams e ON e.id = q.exam_id
  WHERE e.id = p_exam_id AND e.is_published = true
  ORDER BY q.order_index, o.order_index;
$$;
REVOKE ALL ON FUNCTION public.get_exam_options(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_exam_options(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.grade_exam_attempt(p_exam_id uuid, p_answers jsonb)
RETURNS TABLE (score int, total int, passed boolean, correct_by_question jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total int;
  v_score int := 0;
  v_correct jsonb := '{}'::jsonb;
  v_exam_title text;
  v_uid uuid := auth.uid();
  r record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT title INTO v_exam_title FROM public.exams WHERE id = p_exam_id AND is_published = true;
  IF v_exam_title IS NULL THEN RAISE EXCEPTION 'exam not available'; END IF;

  SELECT COUNT(*) INTO v_total FROM public.exam_questions WHERE exam_id = p_exam_id;

  FOR r IN SELECT q.id AS qid,
                  (SELECT o.id FROM public.exam_options o WHERE o.question_id = q.id AND o.is_correct LIMIT 1) AS correct_id
           FROM public.exam_questions q WHERE q.exam_id = p_exam_id
  LOOP
    v_correct := v_correct || jsonb_build_object(r.qid::text, r.correct_id);
    IF (p_answers ->> r.qid::text)::uuid = r.correct_id THEN
      v_score := v_score + 1;
    END IF;
  END LOOP;

  INSERT INTO public.exam_results (user_id, exam_id, exam_title, category, score, total_questions, passed, failed_questions)
  VALUES (v_uid, p_exam_id, v_exam_title, 'general', v_score, v_total,
          (v_score::numeric / NULLIF(v_total,0)) >= 0.6, '[]'::jsonb);

  RETURN QUERY SELECT v_score, v_total, (v_score::numeric / NULLIF(v_total,0)) >= 0.6, v_correct;
END;
$$;
REVOKE ALL ON FUNCTION public.grade_exam_attempt(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.grade_exam_attempt(uuid, jsonb) TO authenticated;

DROP POLICY IF EXISTS "Public read community media" ON storage.objects;
DROP POLICY IF EXISTS "authenticated upload community media" ON storage.objects;
DROP POLICY IF EXISTS "authenticated upload learning materials" ON storage.objects;
DROP POLICY IF EXISTS "authenticated view learning materials" ON storage.objects;

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated only realtime" ON realtime.messages;
CREATE POLICY "authenticated only realtime"
  ON realtime.messages FOR SELECT TO authenticated
  USING (true);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_primary_role(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_primary_role(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_class_id() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_user_class_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_has_beqa_access() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_beqa_access() TO authenticated;
