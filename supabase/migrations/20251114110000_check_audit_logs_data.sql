-- Check if audit_logs table has data
-- This is a diagnostic query to verify audit logging is working

-- Count total audit logs
SELECT 
  COUNT(*) as total_audit_logs,
  MIN(timestamp) as oldest_log,
  MAX(timestamp) as newest_log,
  COUNT(DISTINCT username) as unique_users,
  COUNT(DISTINCT organization_id) as unique_organizations
FROM public.audit_logs;

-- Show recent audit logs (last 24 hours)
SELECT 
  id,
  timestamp,
  username,
  role,
  action,
  organization_name,
  ip_address,
  user_agent
FROM public.audit_logs
WHERE timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC
LIMIT 20;

-- Show all actions in the last 30 days
SELECT 
  action,
  COUNT(*) as count,
  MIN(timestamp) as first_occurrence,
  MAX(timestamp) as last_occurrence
FROM public.audit_logs
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY action
ORDER BY count DESC;

