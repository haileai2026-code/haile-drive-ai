-- Drop listing policy on materials bucket; public CDN access still works via bucket public flag
DROP POLICY IF EXISTS "Authenticated read materials bucket" ON storage.objects;

-- Switch role helpers to SECURITY INVOKER (user_roles RLS already lets users read their own rows)
ALTER FUNCTION public.has_role(uuid, public.app_role) SECURITY INVOKER;
ALTER FUNCTION public.get_primary_role(uuid) SECURITY INVOKER;