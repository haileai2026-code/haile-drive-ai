REVOKE EXECUTE ON FUNCTION public.current_user_class_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_class_id() TO authenticated;