
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('notifications-tick');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'notifications-tick',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url:='https://project--3786d230-489d-42ff-90a6-c37988e1da92.lovable.app/api/public/hooks/notifications-tick',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $cron$
);
