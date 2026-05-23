
-- 1) Gate BEQA diagnostic sessions on beqa_access
DROP POLICY IF EXISTS "student can insert beqa" ON public.beqa_diagnostic_sessions;
CREATE POLICY "student can insert beqa"
ON public.beqa_diagnostic_sessions
FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid() AND public.current_user_has_beqa_access());

DROP POLICY IF EXISTS "student can update own in-progress session" ON public.beqa_diagnostic_sessions;
CREATE POLICY "student can update own in-progress session"
ON public.beqa_diagnostic_sessions
FOR UPDATE TO authenticated
USING (student_id = auth.uid() AND public.current_user_has_beqa_access())
WITH CHECK (student_id = auth.uid() AND public.current_user_has_beqa_access());

-- 2) Community media: allow classmates to read media from posts in their class
DROP POLICY IF EXISTS "Community media read by uploader or staff" ON storage.objects;
DROP POLICY IF EXISTS "Community media read by uploader staff or classmates" ON storage.objects;
CREATE POLICY "Community media read by uploader staff or classmates"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'community-media'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
    OR public.has_role(auth.uid(), 'teacher'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.community_posts p
      WHERE p.media_url IS NOT NULL
        AND position(storage.objects.name in p.media_url) > 0
        AND p.class_id = public.current_user_class_id()
    )
  )
);

-- 3) Remove blanket realtime authenticated policy
DROP POLICY IF EXISTS "authenticated only realtime" ON realtime.messages;
