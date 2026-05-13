
CREATE TABLE public.exam_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exam_id uuid,
  exam_title text,
  category text NOT NULL DEFAULT 'general',
  score integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  failed_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  taken_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exam_results_user ON public.exam_results(user_id, taken_at DESC);
CREATE INDEX idx_exam_results_category ON public.exam_results(category);

ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own results"
  ON public.exam_results FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Students insert own results"
  ON public.exam_results FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners staff view all results"
  ON public.exam_results FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Owners delete results"
  ON public.exam_results FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role));
