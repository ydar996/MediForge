-- Purpose: Enhance rate limiting to support permanent lockouts and admin unlock functionality
-- Adds permanent lockout support and comprehensive login attempt logging

-- Add permanent_lock column to rate_limits table
ALTER TABLE public.rate_limits 
ADD COLUMN IF NOT EXISTS permanent_lock BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS locked_by TEXT, -- Admin who locked/unlocked
ADD COLUMN IF NOT EXISTS unlock_reason TEXT, -- Reason for unlock
ADD COLUMN IF NOT EXISTS last_attempt_ip TEXT,
ADD COLUMN IF NOT EXISTS last_attempt_user_agent TEXT;

-- Create index for permanent locks
CREATE INDEX IF NOT EXISTS idx_rate_limits_permanent_lock ON public.rate_limits(permanent_lock) WHERE permanent_lock = true;

-- Update check_rate_limit function to support permanent lockout
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_type TEXT,
  p_identifier TEXT,
  p_max_attempts INTEGER,
  p_window_minutes INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record public.rate_limits%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_window_start TIMESTAMPTZ;
  v_allowed BOOLEAN;
  v_remaining INTEGER;
  v_reset_at TIMESTAMPTZ;
  v_locked BOOLEAN := false;
BEGIN
  -- Get or create rate limit record
  SELECT * INTO v_record
  FROM public.rate_limits
  WHERE rate_limit_type = p_type
    AND identifier = p_identifier
  FOR UPDATE;

  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.rate_limits (rate_limit_type, identifier, attempts, window_start)
    VALUES (p_type, p_identifier, 0, v_now)
    RETURNING * INTO v_record;
  END IF;

  -- Check if permanently locked (highest priority)
  IF v_record.permanent_lock = true THEN
    v_locked := true;
    v_allowed := false;
    v_remaining := 0;
    v_reset_at := NULL; -- Permanent lock has no reset time
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'reset_at', NULL,
      'locked', true,
      'permanent_lock', true,
      'locked_at', v_record.locked_at,
      'locked_by', v_record.locked_by
    );
  END IF;

  -- Check if temporarily locked (old behavior - now deprecated, but kept for compatibility)
  IF v_record.locked_until IS NOT NULL AND v_record.locked_until > v_now THEN
    v_locked := true;
    v_allowed := false;
    v_remaining := 0;
    v_reset_at := v_record.locked_until;
  ELSE
    -- Clear temporary lockout if expired (convert to permanent if it was a login lockout)
    IF v_record.locked_until IS NOT NULL AND v_record.locked_until <= v_now THEN
      -- For login attempts that were temporarily locked, convert to permanent
      IF p_type = 'login' AND v_record.attempts >= p_max_attempts THEN
        v_record.permanent_lock := true;
        v_record.locked_at := v_now;
        v_record.locked_until := NULL;
      ELSE
        v_record.locked_until := NULL;
        v_record.attempts := 0;
        v_record.window_start := v_now;
      END IF;
    END IF;

    -- Calculate window start
    v_window_start := v_now - (p_window_minutes || ' minutes')::INTERVAL;

    -- If window has expired, reset attempts (but keep permanent lock status)
    IF v_record.window_start < v_window_start AND v_record.permanent_lock = false THEN
      v_record.attempts := 0;
      v_record.window_start := v_now;
    END IF;

    -- Check if limit exceeded
    IF v_record.attempts >= p_max_attempts THEN
      v_allowed := false;
      v_remaining := 0;
      v_reset_at := NULL; -- Permanent lock has no reset time
      
      -- PERMANENT LOCKOUT for login attempts (no expiration)
      IF p_type = 'login' THEN
        v_record.permanent_lock := true;
        v_record.locked_at := v_now;
        v_record.locked_until := NULL;
        v_locked := true;
      END IF;
    ELSE
      v_allowed := true;
      v_remaining := p_max_attempts - v_record.attempts;
      v_reset_at := v_record.window_start + (p_window_minutes || ' minutes')::INTERVAL;
      
      -- Increment attempt counter
      v_record.attempts := v_record.attempts + 1;
      v_record.updated_at := v_now;
    END IF;

    -- Update record
    UPDATE public.rate_limits
    SET attempts = v_record.attempts,
        window_start = v_record.window_start,
        locked_until = v_record.locked_until,
        permanent_lock = v_record.permanent_lock,
        locked_at = v_record.locked_at,
        updated_at = v_now
    WHERE id = v_record.id;
  END IF;

  -- Return result as JSONB
  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'remaining', v_remaining,
    'reset_at', v_reset_at,
    'locked', v_locked,
    'permanent_lock', COALESCE(v_record.permanent_lock, false),
    'locked_at', v_record.locked_at,
    'locked_by', v_record.locked_by
  );
END;
$$;

-- Function: Unlock account (admin function)
CREATE OR REPLACE FUNCTION public.unlock_account(
  p_identifier TEXT,
  p_unlocked_by TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record public.rate_limits%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Get rate limit record
  SELECT * INTO v_record
  FROM public.rate_limits
  WHERE rate_limit_type = 'login'
    AND identifier = p_identifier
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account not found or not locked');
  END IF;

  -- Unlock account
  UPDATE public.rate_limits
  SET permanent_lock = false,
      locked_until = NULL,
      attempts = 0,
      window_start = v_now,
      locked_by = p_unlocked_by,
      unlock_reason = p_reason,
      updated_at = v_now
  WHERE id = v_record.id;

  RETURN jsonb_build_object(
    'success', true,
    'identifier', p_identifier,
    'unlocked_by', p_unlocked_by,
    'unlocked_at', v_now
  );
END;
$$;

-- Function: Get locked accounts
CREATE OR REPLACE FUNCTION public.get_locked_accounts(
  p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  identifier TEXT,
  attempts INTEGER,
  locked_at TIMESTAMPTZ,
  permanent_lock BOOLEAN,
  last_attempt_ip TEXT,
  last_attempt_user_agent TEXT,
  locked_by TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rl.id,
    rl.identifier,
    rl.attempts,
    rl.locked_at,
    rl.permanent_lock,
    rl.last_attempt_ip,
    rl.last_attempt_user_agent,
    rl.locked_by,
    rl.created_at,
    rl.updated_at
  FROM public.rate_limits rl
  WHERE rl.rate_limit_type = 'login'
    AND (rl.permanent_lock = true OR (rl.locked_until IS NOT NULL AND rl.locked_until > NOW()))
  ORDER BY rl.locked_at DESC NULLS LAST;
END;
$$;

-- Function: Get login attempt history
CREATE OR REPLACE FUNCTION public.get_login_attempt_history(
  p_identifier TEXT DEFAULT NULL,
  p_hours INTEGER DEFAULT 24,
  p_limit INTEGER DEFAULT 1000
)
RETURNS TABLE (
  username TEXT,
  action TEXT,
  success BOOLEAN,
  ip_address TEXT,
  user_agent TEXT,
  "timestamp" TIMESTAMPTZ,
  details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.username,
    al.action,
    CASE 
      WHEN al.action LIKE '%success%' OR al.action LIKE '%login%' AND al.action NOT LIKE '%failed%' THEN true
      ELSE false
    END as success,
    al.ip_address,
    al.user_agent,
    al."timestamp",
    al.details
  FROM public.audit_logs al
  WHERE al.action IN ('login_success', 'user_login', 'login_failed', 'rate_limit_exceeded', 'user_login_supabase')
    AND (p_identifier IS NULL OR al.username = p_identifier)
    AND al."timestamp" > NOW() - (p_hours || ' hours')::INTERVAL
  ORDER BY al."timestamp" DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permissions to service_role only
REVOKE ALL ON FUNCTION public.unlock_account(TEXT, TEXT, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.unlock_account(TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.unlock_account(TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_account(TEXT, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.get_locked_accounts(UUID) FROM public;
REVOKE ALL ON FUNCTION public.get_locked_accounts(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.get_locked_accounts(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_locked_accounts(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.get_login_attempt_history(TEXT, INTEGER, INTEGER) FROM public;
REVOKE ALL ON FUNCTION public.get_login_attempt_history(TEXT, INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.get_login_attempt_history(TEXT, INTEGER, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_login_attempt_history(TEXT, INTEGER, INTEGER) TO service_role;

-- Add comments
COMMENT ON FUNCTION public.unlock_account(TEXT, TEXT, TEXT) IS 'Unlocks a permanently locked account (admin function)';
COMMENT ON FUNCTION public.get_locked_accounts(UUID) IS 'Gets all locked accounts for admin management';
COMMENT ON FUNCTION public.get_login_attempt_history(TEXT, INTEGER, INTEGER) IS 'Gets comprehensive login attempt history with IP addresses and user agents';

