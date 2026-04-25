-- Cleanup orphan uploads schedule
--
-- What this does:
-- - Runs once per day at 3:15 AM UTC
-- - Calls the cleanup edge function
-- - Deletes only files in the `documents` bucket that are older than the
--   age threshold and are no longer referenced by any note
--
-- Before running:
-- 1) The project ref is already filled in for your workspace
-- 2) Replace <cleanup-secret> with a long random secret you choose
--
-- What is cleanup-secret?
-- It is a shared secret between this cron job and the edge function.
-- The function checks the `x-cleanup-secret` header and only runs when it
-- matches the `CLEANUP_CRON_SECRET` value configured in your edge-function
-- secrets/environment.
--
-- Recommended secret format:
-- - 32+ random characters
-- - Store it in your password manager
-- - Use the exact same value in:
--   - the edge function secret: CLEANUP_CRON_SECRET
--   - this SQL snippet: x-cleanup-secret

-- Optional: remove any existing schedule before recreating it
-- select cron.unschedule('cleanup-orphan-documents-daily');

select cron.schedule(
  'cleanup-orphan-documents-daily',
  '15 3 * * *',
  $$
  select net.http_post(
    url := 'https://gskyjbvjxuznozinkxfi.supabase.co/functions/v1/cleanup-orphan-documents',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cleanup-secret', '<cleanup-secret>'
    ),
    body := '{"maxAgeHours":24,"dryRun":false}'::jsonb
  ) as request_id;
  $$
);
