-- Debug: Check if any audit logs exist at all (regardless of timestamp)
-- This helps verify if inserts are actually working

SELECT 
  COUNT(*) as total_logs_all_time,
  MIN(timestamp) as oldest_log,
  MAX(timestamp) as newest_log,
  NOW() as current_time,
  NOW() - MAX(timestamp) as time_since_last_log
FROM public.audit_logs;

-- Show the 10 most recent audit logs (if any)
SELECT 
  id,
  timestamp,
  username,
  role,
  action,
  organization_name,
  organization_id,
  ip_address,
  details,
  NOW() as current_time,
  EXTRACT(EPOCH FROM (NOW() - timestamp)) / 60 as minutes_ago
FROM public.audit_logs
ORDER BY timestamp DESC
LIMIT 10;

-- Check if there are any logs in the last hour (to catch recent inserts)
SELECT 
  COUNT(*) as logs_last_hour,
  array_agg(DISTINCT action) as actions
FROM public.audit_logs
WHERE timestamp > NOW() - INTERVAL '1 hour';

