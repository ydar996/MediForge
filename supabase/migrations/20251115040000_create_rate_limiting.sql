-- Purpose: Create rate limiting system for login attempts and intake submissions
-- Prevents brute force attacks and spam by tracking attempts per time window

-- Create rate_limits table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rate_limit_type TEXT NOT NULL, -- 'login' or 'intake'
  identifier TEXT NOT NULL, -- Username, email, or IP address
  attempts INTEGER DEFAULT 0 NOT NULL,
  window_start TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  locked_until TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(rate_limit_type, identifier)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_type_identifier ON public.rate_limits(rate_limit_type, identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON public.rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_locked_until ON public.rate_limits(locked_until);

-- Enable Row Level Security
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to do everything
CREATE POLICY "Service role can manage rate limits" ON public.rate_limits
  FOR ALL USING (auth.role() = 'service_role');

-- Policy: Allow inserting rate limit attempts (for tracking)
CREATE POLICY "Allow rate limit inserts" ON public.rate_limits
  FOR INSERT WITH CHECK (true);

-- Function: Check rate limit
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

  -- Check if locked out
  IF v_record.locked_until IS NOT NULL AND v_record.locked_until > v_now THEN
    v_locked := true;
    v_allowed := false;
    v_remaining := 0;
    v_reset_at := v_record.locked_until;
  ELSE
    -- Clear lockout if expired
    IF v_record.locked_until IS NOT NULL AND v_record.locked_until <= v_now THEN
      v_record.locked_until := NULL;
      v_record.attempts := 0;
      v_record.window_start := v_now;
    END IF;

    -- Calculate window start
    v_window_start := v_now - (p_window_minutes || ' minutes')::INTERVAL;

    -- If window has expired, reset attempts
    IF v_record.window_start < v_window_start THEN
      v_record.attempts := 0;
      v_record.window_start := v_now;
    END IF;

    -- Check if limit exceeded
    IF v_record.attempts >= p_max_attempts THEN
      v_allowed := false;
      v_remaining := 0;
      v_reset_at := v_record.window_start + (p_window_minutes || ' minutes')::INTERVAL;
      
      -- Lock out for login attempts (15 minutes)
      IF p_type = 'login' THEN
        v_record.locked_until := v_now + '15 minutes'::INTERVAL;
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
        updated_at = v_now
    WHERE id = v_record.id;
  END IF;

  -- Return result as JSONB
  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'remaining', v_remaining,
    'reset_at', v_reset_at,
    'locked', v_locked
  );
END;
$$;

-- Function: Record failed attempt
CREATE OR REPLACE FUNCTION public.record_rate_limit_attempt(
  p_type TEXT,
  p_identifier TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This is handled by check_rate_limit, but we provide this for explicit recording
  -- Just call check_rate_limit with default values to increment counter
  PERFORM public.check_rate_limit(p_type, p_identifier, 1000, 60);
END;
$$;

-- Function: Clear rate limit (on successful action)
CREATE OR REPLACE FUNCTION public.clear_rate_limit(
  p_type TEXT,
  p_identifier TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE rate_limit_type = p_type
    AND identifier = p_identifier;
END;
$$;

-- Grant execute permissions to service_role only (rate limiting is sensitive)
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM public;
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.record_rate_limit_attempt(TEXT, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.record_rate_limit_attempt(TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.record_rate_limit_attempt(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_rate_limit_attempt(TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.clear_rate_limit(TEXT, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.clear_rate_limit(TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.clear_rate_limit(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.clear_rate_limit(TEXT, TEXT) TO service_role;

-- Add comments
COMMENT ON TABLE public.rate_limits IS 'Tracks rate limits for login attempts and intake submissions';
COMMENT ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) IS 'Checks if an action is rate limited and increments attempt counter';
COMMENT ON FUNCTION public.record_rate_limit_attempt(TEXT, TEXT) IS 'Records a failed attempt';
COMMENT ON FUNCTION public.clear_rate_limit(TEXT, TEXT) IS 'Clears rate limit for an identifier (on successful action)';

