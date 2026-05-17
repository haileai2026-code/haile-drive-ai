-- Ensure materials bucket is private (already is, idempotent)
UPDATE storage.buckets SET public = false WHERE id = 'materials';

-- Replace the broad "authenticated read" with class-scoped read
DROP POLICY IF EXISTS "Authenticated read materials bucket" ON storage.objects;

CREATE POLICY "Class-scoped read materials bucket"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'materials'
  AND (
    has_role(auth.uid(), 'owner')
    OR has_role(auth.uid(), 'staff')
    OR has_role(auth.uid(), 'teacher')
    OR EXISTS (
      SELECT 1 FROM public.materials m
      WHERE m.file_url LIKE '%' || storage.objects.name
        AND (
          m.class_id IS NULL
          OR m.class_id = public.current_user_class_id()
        )
    )
  )
);