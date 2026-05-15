
-- Add 'lead' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lead';

-- Add payment_status to candidates
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'
  CHECK (payment_status IN ('unpaid', 'paid', 'partial'));

-- New users default to 'lead' until payment confirmed (owner email still becomes owner)
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );

  IF lower(NEW.email) = 'haileai.2026@gmail.com' THEN
    assigned_role := 'owner';
  ELSE
    assigned_role := 'lead';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$function$;
