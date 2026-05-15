
ALTER TABLE public.beqa_diagnostic_sessions
  ADD COLUMN IF NOT EXISTS assessment_type text NOT NULL DEFAULT 'biometric',
  ADD COLUMN IF NOT EXISTS psychological_score numeric,
  ADD COLUMN IF NOT EXISTS community_type text,
  ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recommendation text;

ALTER TABLE public.beqa_diagnostic_sessions
  DROP CONSTRAINT IF EXISTS beqa_assessment_type_check;
ALTER TABLE public.beqa_diagnostic_sessions
  ADD CONSTRAINT beqa_assessment_type_check
  CHECK (assessment_type IN ('biometric','psychological'));

ALTER TABLE public.beqa_diagnostic_sessions
  DROP CONSTRAINT IF EXISTS beqa_recommendation_check;
ALTER TABLE public.beqa_diagnostic_sessions
  ADD CONSTRAINT beqa_recommendation_check
  CHECK (recommendation IS NULL OR recommendation IN ('A','B','C'));
