
CREATE TYPE public.notification_channel AS ENUM ('sms','whatsapp');
CREATE TYPE public.notification_status  AS ENUM ('pending','sent','failed','cancelled');

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.schedule_events(id) ON DELETE SET NULL,
  channel public.notification_channel NOT NULL,
  to_phone text NOT NULL,
  message text NOT NULL,
  language text NOT NULL DEFAULT 'he',
  status public.notification_status NOT NULL DEFAULT 'pending',
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  provider_sid text,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_pending ON public.notifications (scheduled_at)
  WHERE status = 'pending';
CREATE INDEX idx_notifications_candidate ON public.notifications (candidate_id);

CREATE TRIGGER notifications_set_updated
BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners staff view notifications" ON public.notifications
FOR SELECT TO authenticated
USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'staff'));

CREATE POLICY "Owners staff insert notifications" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'staff'));

CREATE POLICY "Owners staff update notifications" ON public.notifications
FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'staff'));

CREATE POLICY "Owners delete notifications" ON public.notifications
FOR DELETE TO authenticated
USING (has_role(auth.uid(),'owner'));

CREATE POLICY "Students view own notifications" ON public.notifications
FOR SELECT TO authenticated
USING (
  candidate_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = notifications.candidate_id
      AND c.email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  )
);
