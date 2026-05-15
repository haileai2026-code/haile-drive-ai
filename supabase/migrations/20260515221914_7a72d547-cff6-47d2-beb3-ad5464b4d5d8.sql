CREATE POLICY "Authenticated read teacher profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(id, 'teacher'::public.app_role));