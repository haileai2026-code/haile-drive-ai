
-- Sessions table
CREATE TABLE public.beqa_diagnostic_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  baseline_hr numeric(5,2),
  stress_hr numeric(5,2),
  reaction_time_avg numeric(8,2),
  accuracy_score numeric(5,2),
  final_beqa_score numeric(5,2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_beqa_sessions_student ON public.beqa_diagnostic_sessions(student_id, start_time DESC);

ALTER TABLE public.beqa_diagnostic_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own sessions" ON public.beqa_diagnostic_sessions
  FOR SELECT TO authenticated USING (student_id = auth.uid());

CREATE POLICY "Students insert own sessions" ON public.beqa_diagnostic_sessions
  FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students update own sessions" ON public.beqa_diagnostic_sessions
  FOR UPDATE TO authenticated USING (student_id = auth.uid());

CREATE POLICY "Owners staff view all sessions" ON public.beqa_diagnostic_sessions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Owners delete sessions" ON public.beqa_diagnostic_sessions
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Teachers view their students sessions" ON public.beqa_diagnostic_sessions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = beqa_diagnostic_sessions.student_id
      AND c.assigned_teacher_id = auth.uid()
  ));

CREATE TRIGGER trg_beqa_sessions_updated
  BEFORE UPDATE ON public.beqa_diagnostic_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Raw biometric log
CREATE TABLE public.raw_biometric_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.beqa_diagnostic_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  event_type text NOT NULL,
  bpm numeric(5,2),
  hrv numeric(6,2),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_raw_bio_session ON public.raw_biometric_log(session_id, recorded_at);

ALTER TABLE public.raw_biometric_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own bio log" ON public.raw_biometric_log
  FOR SELECT TO authenticated USING (student_id = auth.uid());

CREATE POLICY "Students insert own bio log" ON public.raw_biometric_log
  FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

CREATE POLICY "Owners staff view all bio log" ON public.raw_biometric_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Owners delete bio log" ON public.raw_biometric_log
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Teachers view their students bio log" ON public.raw_biometric_log
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = raw_biometric_log.student_id
      AND c.assigned_teacher_id = auth.uid()
  ));
