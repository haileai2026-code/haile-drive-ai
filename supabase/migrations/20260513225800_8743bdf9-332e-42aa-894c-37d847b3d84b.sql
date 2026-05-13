
CREATE POLICY "Teachers view their candidates results"
  ON public.exam_results FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = exam_results.user_id AND c.assigned_teacher_id = auth.uid()
  ));
