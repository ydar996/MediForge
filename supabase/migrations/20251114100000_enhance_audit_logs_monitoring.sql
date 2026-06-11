-- Purpose: enhance audit_logs table for security monitoring and alerting

-- Add indexes for security monitoring queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address) WHERE ip_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_timestamp ON audit_logs(action, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_username_timestamp ON audit_logs(username, timestamp DESC);

-- Create function to detect failed login attempts
CREATE OR REPLACE FUNCTION public.get_failed_login_attempts(
  p_time_window_minutes INTEGER DEFAULT 5,
  p_threshold INTEGER DEFAULT 5
)
RETURNS TABLE (
  ip_address TEXT,
  username TEXT,
  attempt_count BIGINT,
  last_attempt TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ip_address,
    username,
    COUNT(*) as attempt_count,
    MAX(timestamp) as last_attempt
  FROM public.audit_logs
  WHERE action = 'login_failed'
    AND timestamp > NOW() - (p_time_window_minutes || ' minutes')::INTERVAL
  GROUP BY ip_address, username
  HAVING COUNT(*) >= p_threshold
  ORDER BY attempt_count DESC, last_attempt DESC;
$$;

-- Create function to detect suspicious activity
CREATE OR REPLACE FUNCTION public.get_suspicious_activity(
  p_time_window_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  ip_address TEXT,
  action TEXT,
  event_count BIGINT,
  first_event TIMESTAMPTZ,
  last_event TIMESTAMPTZ,
  usernames TEXT[]
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ip_address,
    action,
    COUNT(*) as event_count,
    MIN(timestamp) as first_event,
    MAX(timestamp) as last_event,
    ARRAY_AGG(DISTINCT username) as usernames
  FROM public.audit_logs
  WHERE timestamp > NOW() - (p_time_window_hours || ' hours')::INTERVAL
    AND ip_address IS NOT NULL
    AND action IN (
      'login_failed',
      'unauthorized_access_attempt',
      'rpc_failure',
      'intake_submission_approved',
      'intake_submission_rejected',
      'patient_deleted',
      'user_profile_updated'
    )
  GROUP BY ip_address, action
  HAVING COUNT(*) >= 10
  ORDER BY event_count DESC, last_event DESC;
$$;

-- Create function to get security summary
CREATE OR REPLACE FUNCTION public.get_security_summary(
  p_time_window_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  total_events BIGINT,
  failed_logins BIGINT,
  successful_logins BIGINT,
  unauthorized_attempts BIGINT,
  unique_ips BIGINT,
  unique_users BIGINT,
  top_actions JSONB
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE action = 'login_failed') as failed_logins,
    COUNT(*) FILTER (WHERE action = 'login_success' OR action = 'user_login') as successful_logins,
    COUNT(*) FILTER (WHERE action = 'unauthorized_access_attempt') as unauthorized_attempts,
    COUNT(DISTINCT ip_address) FILTER (WHERE ip_address IS NOT NULL) as unique_ips,
    COUNT(DISTINCT username) as unique_users,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'action', action,
        'count', action_count
      ) ORDER BY action_count DESC)
      FROM (
        SELECT action, COUNT(*) as action_count
        FROM public.audit_logs
        WHERE timestamp > NOW() - (p_time_window_hours || ' hours')::INTERVAL
        GROUP BY action
        ORDER BY action_count DESC
        LIMIT 10
      ) top_actions
    ) as top_actions
  FROM public.audit_logs
  WHERE timestamp > NOW() - (p_time_window_hours || ' hours')::INTERVAL;
$$;

-- Grant execute permissions to service_role only
REVOKE ALL ON FUNCTION public.get_failed_login_attempts(INTEGER, INTEGER) FROM public;
REVOKE ALL ON FUNCTION public.get_failed_login_attempts(INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.get_failed_login_attempts(INTEGER, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_failed_login_attempts(INTEGER, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.get_suspicious_activity(INTEGER) FROM public;
REVOKE ALL ON FUNCTION public.get_suspicious_activity(INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.get_suspicious_activity(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_suspicious_activity(INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.get_security_summary(INTEGER) FROM public;
REVOKE ALL ON FUNCTION public.get_security_summary(INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.get_security_summary(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_security_summary(INTEGER) TO service_role;

-- Add comments
COMMENT ON FUNCTION public.get_failed_login_attempts(INTEGER, INTEGER) IS 'Detects failed login attempts within a time window';
COMMENT ON FUNCTION public.get_suspicious_activity(INTEGER) IS 'Detects suspicious activity patterns within a time window';
COMMENT ON FUNCTION public.get_security_summary(INTEGER) IS 'Returns security summary statistics within a time window';


