CREATE TABLE public.biometric_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now(),
  consent_text_version text NOT NULL,
  granted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.biometric_consents TO authenticated;
GRANT ALL ON public.biometric_consents TO service_role;

ALTER TABLE public.biometric_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student inserts own consent"
ON public.biometric_consents FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid());

CREATE POLICY "student reads own consent"
ON public.biometric_consents FOR SELECT TO authenticated
USING (student_id = auth.uid());

CREATE POLICY "owner staff read all consents"
ON public.biometric_consents FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'staff'));

CREATE INDEX idx_biometric_consents_student ON public.biometric_consents (student_id, consented_at DESC);

CREATE TRIGGER trg_biometric_consents_updated
BEFORE UPDATE ON public.biometric_consents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();