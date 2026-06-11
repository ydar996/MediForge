-- Purpose: Create RPC function to get audit logs with filtering
-- This allows platform admins to view detailed audit log entries

CREATE OR REPLACE FUNCTION public.get_audit_logs(
  p_action_filter TEXT DEFAULT NULL,
  p_hours INTEGER DEFAULT 24,
  p_limit INTEGER DEFAULT 500
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  user_name TEXT,
  role TEXT,
  action TEXT,
  event_type TEXT,
  organization_id UUID,
  organization_name TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  "timestamp" TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    audit_logs.id,
    audit_logs.username,
    audit_logs.user_name,
    audit_logs.role,
    audit_logs.action,
    audit_logs.event_type,
    audit_logs.organization_id,
    audit_logs.organization_name,
    audit_logs.ip_address,
    audit_logs.user_agent,
    audit_logs.details,
    audit_logs."timestamp"
  FROM public.audit_logs
  WHERE 
    (p_action_filter IS NULL OR 
     (p_action_filter = 'login_success' AND (action = 'login_success' OR action = 'user_login')) OR
     (p_action_filter = 'login_failed' AND action = 'login_failed') OR
     (p_action_filter = 'unauthorized_access_attempt' AND action = 'unauthorized_access_attempt') OR
     (p_action_filter = 'all'))
    AND "timestamp" > NOW() - (p_hours || ' hours')::INTERVAL
  ORDER BY "timestamp" DESC
  LIMIT p_limit;
$$;

-- Grant execute permissions to service_role only
REVOKE ALL ON FUNCTION public.get_audit_logs(TEXT, INTEGER, INTEGER) FROM public;
REVOKE ALL ON FUNCTION public.get_audit_logs(TEXT, INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.get_audit_logs(TEXT, INTEGER, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_audit_logs(TEXT, INTEGER, INTEGER) TO service_role;

-- Add comment
COMMENT ON FUNCTION public.get_audit_logs(TEXT, INTEGER, INTEGER) IS 'Retrieves audit log entries with optional action filter and time window';

