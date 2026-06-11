-- Purpose: Add patient_login rate limit support (15 min lockout, not permanent)
-- Extends check_rate_limit to handle patient_login type

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
  v_permanent_lock BOOLEAN := false;
BEGIN
  SELECT * INTO v_record
  FROM public.rate_limits
  WHERE rate_limit_type = p_type
    AND identifier = p_identifier
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.rate_limits (rate_limit_type, identifier, attempts, window_start)
    VALUES (p_type, p_identifier, 0, v_now)
    RETURNING * INTO v_record;
  END IF;

  -- Check permanent lock (login only, not platform_login or patient_login)
  IF v_record.permanent_lock = true AND p_type = 'login' THEN
    v_locked := true;
    v_allowed := false;
    v_remaining := 0;
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

  -- Check temporary lockout
  IF v_record.locked_until IS NOT NULL AND v_record.locked_until > v_now THEN
    v_locked := true;
    v_allowed := false;
    v_remaining := 0;
    v_reset_at := v_record.locked_until;
  ELSE
    IF v_record.locked_until IS NOT NULL AND v_record.locked_until <= v_now THEN
      IF p_type = 'login' AND v_record.attempts >= p_max_attempts THEN
        v_record.permanent_lock := true;
        v_record.locked_at := v_now;
        v_record.locked_until := NULL;
      ELSIF p_type IN ('platform_login', 'patient_login') THEN
        v_record.locked_until := NULL;
        v_record.attempts := 0;
        v_record.window_start := v_now;
      ELSE
        v_record.locked_until := NULL;
        v_record.attempts := 0;
        v_record.window_start := v_now;
      END IF;
    END IF;

    v_window_start := v_now - (p_window_minutes || ' minutes')::INTERVAL;

    IF v_record.window_start < v_window_start AND v_record.permanent_lock = false THEN
      v_record.attempts := 0;
      v_record.window_start := v_now;
    END IF;

    IF v_record.attempts >= p_max_attempts THEN
      v_allowed := false;
      v_remaining := 0;

      IF p_type = 'login' THEN
        v_record.permanent_lock := true;
        v_record.locked_at := v_now;
        v_record.locked_until := NULL;
        v_locked := true;
        v_reset_at := NULL;
      ELSIF p_type = 'platform_login' THEN
        v_record.locked_until := v_now + '30 minutes'::INTERVAL;
        v_record.locked_at := v_now;
        v_reset_at := v_record.locked_until;
        v_locked := true;
      ELSIF p_type = 'patient_login' THEN
        v_record.locked_until := v_now + '15 minutes'::INTERVAL;
        v_record.locked_at := v_now;
        v_reset_at := v_record.locked_until;
        v_locked := true;
      ELSE
        v_reset_at := v_record.window_start + (p_window_minutes || ' minutes')::INTERVAL;
      END IF;
    ELSE
      v_allowed := true;
      v_remaining := p_max_attempts - v_record.attempts;
      v_reset_at := v_record.window_start + (p_window_minutes || ' minutes')::INTERVAL;
      v_record.attempts := v_record.attempts + 1;
      v_record.updated_at := v_now;
    END IF;

    UPDATE public.rate_limits
    SET attempts = v_record.attempts,
        window_start = v_record.window_start,
        locked_until = v_record.locked_until,
        locked_at = v_record.locked_at,
        permanent_lock = COALESCE(v_record.permanent_lock, false),
        updated_at = v_now
    WHERE id = v_record.id;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'remaining', COALESCE(v_remaining, 0),
    'reset_at', v_reset_at,
    'locked', v_locked,
    'permanent_lock', v_permanent_lock
  );
END;
$$;
