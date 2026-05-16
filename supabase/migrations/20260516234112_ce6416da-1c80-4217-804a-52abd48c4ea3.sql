-- Voucher tracking table
CREATE TABLE public.voucher_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  class_id uuid,
  voucher_amount numeric NOT NULL DEFAULT 25000,
  course_start_date date,
  payment_1_status text NOT NULL DEFAULT 'pending' CHECK (payment_1_status IN ('pending','submitted','received')),
  payment_1_date date,
  payment_1_doc_url text,
  payment_1_amount numeric DEFAULT 0,
  payment_2_status text NOT NULL DEFAULT 'pending' CHECK (payment_2_status IN ('pending','submitted','received')),
  payment_2_date date,
  payment_2_doc_url text,
  payment_2_amount numeric DEFAULT 0,
  payment_3_status text NOT NULL DEFAULT 'pending' CHECK (payment_3_status IN ('pending','submitted','received')),
  payment_3_date date,
  payment_3_doc_url text,
  payment_3_amount numeric DEFAULT 0,
  total_received numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(candidate_id)
);

CREATE INDEX idx_voucher_tracking_candidate ON public.voucher_tracking(candidate_id);
CREATE INDEX idx_voucher_tracking_class ON public.voucher_tracking(class_id);

ALTER TABLE public.voucher_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners staff view vouchers" ON public.voucher_tracking
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Owners staff insert vouchers" ON public.voucher_tracking
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Owners staff update vouchers" ON public.voucher_tracking
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Owners delete vouchers" ON public.voucher_tracking
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER trg_voucher_tracking_updated_at
  BEFORE UPDATE ON public.voucher_tracking
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket for voucher documents
INSERT INTO storage.buckets (id, name, public) VALUES ('voucher-documents', 'voucher-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Owners staff read voucher docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'voucher-documents' AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'staff')));

CREATE POLICY "Owners staff upload voucher docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voucher-documents' AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'staff')));

CREATE POLICY "Owners staff update voucher docs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'voucher-documents' AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'staff')));

CREATE POLICY "Owners delete voucher docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'voucher-documents' AND public.has_role(auth.uid(), 'owner'));