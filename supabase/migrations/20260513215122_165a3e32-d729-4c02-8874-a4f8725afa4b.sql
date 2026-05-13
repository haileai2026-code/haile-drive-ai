-- 1) Storage: tighten materials bucket listing
DROP POLICY IF EXISTS "Public read materials bucket" ON storage.objects;
CREATE POLICY "Authenticated read materials bucket"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'materials');

-- 2) Lock down SECURITY DEFINER trigger functions (no direct EXECUTE needed)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.candidates_sync_teacher() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.attendance_sync_makeup() FROM PUBLIC, anon, authenticated;

-- 3) Role-check helpers: only authenticated users (used by RLS); revoke from anon/public
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_primary_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_primary_role(uuid) TO authenticated;