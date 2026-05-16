
-- 1. Exam results: remove student self-insert. Only grade_exam_attempt (SECURITY DEFINER) writes.
DROP POLICY IF EXISTS "Students insert own results" ON public.exam_results;

-- 2. Materials bucket → private
UPDATE storage.buckets SET public = false WHERE id = 'materials';

DROP POLICY IF EXISTS "Authenticated read materials bucket" ON storage.objects;
CREATE POLICY "Authenticated read materials bucket"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'materials');

-- 3. Community-media: restrict SELECT to uploader (folder = auth.uid) or staff/owner/teacher
DROP POLICY IF EXISTS "Authenticated read community-media" ON storage.objects;
DROP POLICY IF EXISTS "authenticated view community media" ON storage.objects;
DROP POLICY IF EXISTS "Community media read by class members" ON storage.objects;

CREATE POLICY "Community media read by uploader or staff"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'community-media'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
    OR public.has_role(auth.uid(), 'teacher'::app_role)
  )
);

-- 4. Realtime: scope subscriptions. Drop permissive policy and add scoped one.
DO $$
BEGIN
  EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP POLICY IF EXISTS "Authenticated can read realtime" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated_select_messages" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated read all realtime" ON realtime.messages;

CREATE POLICY "Realtime scoped by role or class topic"
ON realtime.messages FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'owner'::app_role)
  OR public.has_role(auth.uid(), 'staff'::app_role)
  OR public.has_role(auth.uid(), 'teacher'::app_role)
  OR (
    -- class:<uuid> topic must match the student's class
    realtime.topic() = 'class:' || COALESCE(public.current_user_class_id()::text, '')
  )
  OR (
    -- user:<uuid> topic must match the user
    realtime.topic() = 'user:' || auth.uid()::text
  )
);
