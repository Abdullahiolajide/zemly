-- Schedule daily cleanup of orphan uploads older than 24 hours.
-- Replace <project-ref> and <cleanup-secret> before running.

-- Create daily cron schedule (3:15 AM UTC)
select cron.schedule(
  'cleanup-orphan-documents-daily',
  '15 3 * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/cleanup-orphan-documents',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cleanup-secret', '<cleanup-secret>'
    ),
    body := '{"maxAgeHours":24}'::jsonb
  ) as request_id;
  $$
);

-- Remove existing schedule if needed
-- select cron.unschedule('cleanup-orphan-documents-daily');
