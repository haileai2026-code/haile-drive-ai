-- Private bucket for driver folder docs
INSERT INTO storage.buckets (id, name, public)
VALUES ('candidate-documents', 'candidate-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.candidate_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  label text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_documents_candidate ON public.candidate_documents(candidate_id);

ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners staff view docs" ON public.candidate_documents
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Teachers view their candidate docs" ON public.candidate_documents
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM candidates c WHERE c.id = candidate_documents.candidate_id AND c.assigned_teacher_id = auth.uid()));

CREATE POLICY "Owners staff insert docs" ON public.candidate_documents
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Owners staff update docs" ON public.candidate_documents
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Owners delete docs" ON public.candidate_documents
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Storage RLS for the private bucket
CREATE POLICY "Owners staff read candidate docs" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'candidate-documents' AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

CREATE POLICY "Owners staff upload candidate docs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'candidate-documents' AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

CREATE POLICY "Owners staff update candidate docs" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'candidate-documents' AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

CREATE POLICY "Owners staff delete candidate docs" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'candidate-documents' AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

CREATE POLICY "Teachers view candidate doc files" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'candidate-documents'
  AND EXISTS (
    SELECT 1 FROM public.candidate_documents d
    JOIN public.candidates c ON c.id = d.candidate_id
    WHERE d.file_path = storage.objects.name AND c.assigned_teacher_id = auth.uid()
  )
);
