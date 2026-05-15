
-- Enums
CREATE TYPE public.community_post_type AS ENUM ('post','question','announcement');
CREATE TYPE public.feedback_type AS ENUM ('bug','feature','complaint','compliment');
CREATE TYPE public.feedback_status AS ENUM ('open','in_review','resolved');
CREATE TYPE public.contact_recipient AS ENUM ('owner','teacher','secretary');

-- Helper: current user's class id (via candidates by email)
CREATE OR REPLACE FUNCTION public.current_user_class_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.class_id FROM public.candidates c
  JOIN public.profiles p ON p.id = auth.uid()
  WHERE c.email IS NOT NULL AND lower(c.email) = lower(p.email)
  LIMIT 1
$$;

-- community_posts
CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  class_id uuid,
  content text NOT NULL,
  media_url text,
  post_type public.community_post_type NOT NULL DEFAULT 'post',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cposts_class ON public.community_posts(class_id, created_at DESC);
CREATE INDEX idx_cposts_type ON public.community_posts(post_type, created_at DESC);
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read class posts and announcements"
  ON public.community_posts FOR SELECT TO authenticated
  USING (
    post_type = 'announcement'
    OR has_role(auth.uid(), 'owner')
    OR has_role(auth.uid(), 'staff')
    OR EXISTS (SELECT 1 FROM public.classes cl WHERE cl.id = community_posts.class_id AND cl.teacher_id = auth.uid())
    OR class_id = public.current_user_class_id()
  );

CREATE POLICY "Members create posts in own class"
  ON public.community_posts FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      (post_type IN ('post','question')
        AND (class_id = public.current_user_class_id()
             OR has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff')
             OR EXISTS (SELECT 1 FROM public.classes cl WHERE cl.id = community_posts.class_id AND cl.teacher_id = auth.uid())))
      OR (post_type = 'announcement'
        AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff')
             OR EXISTS (SELECT 1 FROM public.classes cl WHERE cl.id = community_posts.class_id AND cl.teacher_id = auth.uid())))
    )
  );

CREATE POLICY "Author or owner update post"
  ON public.community_posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR has_role(auth.uid(), 'owner'));

CREATE POLICY "Author or owner delete post"
  ON public.community_posts FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR has_role(auth.uid(), 'owner'));

-- community_comments
CREATE TABLE public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ccomments_post ON public.community_comments(post_id, created_at);
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read comments on visible posts"
  ON public.community_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = community_comments.post_id));

CREATE POLICY "Insert comment when post visible"
  ON public.community_comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = community_comments.post_id)
  );

CREATE POLICY "Author or owner delete comment"
  ON public.community_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR has_role(auth.uid(), 'owner'));

-- feedback_reports
CREATE TABLE public.feedback_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  type public.feedback_type NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  status public.feedback_status NOT NULL DEFAULT 'open',
  admin_response text,
  responded_by uuid,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_author ON public.feedback_reports(author_id, created_at DESC);
CREATE INDEX idx_feedback_status ON public.feedback_reports(status, created_at DESC);
ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Author reads own feedback"
  ON public.feedback_reports FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Author inserts own feedback"
  ON public.feedback_reports FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Owner or staff update feedback"
  ON public.feedback_reports FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Owner deletes feedback"
  ON public.feedback_reports FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'owner'));

-- contact_messages (threaded)
CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_role public.contact_recipient NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  parent_id uuid REFERENCES public.contact_messages(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contact_sender ON public.contact_messages(sender_id, created_at DESC);
CREATE INDEX idx_contact_parent ON public.contact_messages(parent_id);
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sender or admin reads contact"
  ON public.contact_messages FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR has_role(auth.uid(), 'owner')
    OR has_role(auth.uid(), 'staff')
    OR (recipient_role = 'teacher' AND EXISTS (
        SELECT 1 FROM public.candidates c
        JOIN public.classes cl ON cl.id = c.class_id
        WHERE cl.teacher_id = auth.uid()
          AND (c.id = contact_messages.sender_id
               OR (c.email IS NOT NULL AND lower(c.email) = lower((SELECT p.email FROM public.profiles p WHERE p.id = contact_messages.sender_id))))
    ))
  );

CREATE POLICY "Authenticated insert contact"
  ON public.contact_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Admin or recipient updates contact"
  ON public.contact_messages FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'owner')
    OR has_role(auth.uid(), 'staff')
    OR (recipient_role = 'teacher' AND EXISTS (
        SELECT 1 FROM public.candidates c
        JOIN public.classes cl ON cl.id = c.class_id
        WHERE cl.teacher_id = auth.uid()
          AND (c.email IS NOT NULL AND lower(c.email) = lower((SELECT p.email FROM public.profiles p WHERE p.id = contact_messages.sender_id)))
    ))
  );

CREATE POLICY "Owner deletes contact"
  ON public.contact_messages FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'owner'));

-- updated_at triggers
CREATE TRIGGER community_posts_updated BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER feedback_reports_updated BEFORE UPDATE ON public.feedback_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER TABLE public.community_posts REPLICA IDENTITY FULL;
ALTER TABLE public.community_comments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_comments;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('community-media','community-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read community media"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'community-media');

CREATE POLICY "Authenticated upload to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner deletes own media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'community-media' AND (storage.foldername(name))[1] = auth.uid()::text);
