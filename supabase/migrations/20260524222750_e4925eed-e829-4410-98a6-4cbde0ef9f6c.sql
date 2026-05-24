
DROP POLICY IF EXISTS "Authenticated read materials" ON public.materials;

CREATE POLICY "Scoped read materials"
ON public.materials
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role)
  OR has_role(auth.uid(), 'staff'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
  OR class_id IS NULL
  OR class_id = current_user_class_id()
);
