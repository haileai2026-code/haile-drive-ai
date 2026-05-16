ALTER TABLE public.schedule_events ADD COLUMN IF NOT EXISTS room_url text;
ALTER TABLE public.schedule_events ADD COLUMN IF NOT EXISTS is_live boolean NOT NULL DEFAULT false;