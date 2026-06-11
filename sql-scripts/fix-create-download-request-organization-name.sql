-- Fix create_download_request function to join organizations table for organization_name
-- The users table doesn't have organization_name column, need to join with organizations table

CREATE OR REPLACE FUNCTION create_download_request(
  p_request_type TEXT,
  p_password_hash TEXT,
  p_request_reason TEXT DEFAULT NULL,
  p_requested_data_scope TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_username TEXT;
  v_role TEXT;
  v_org_id UUID;
  v_org_name TEXT;
  v_requires_admin BOOLEAN;
  v_requires_doctor BOOLEAN;
  v_required_count INTEGER;
  v_request_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Get current user info and organization name from join
  SELECT 
    u.id, 
    u.username, 
    u.role, 
    u.organization_id,
    COALESCE(o.name, 'Unknown Organization') as org_name
  INTO v_user_id, v_username, v_role, v_org_id, v_org_name
  FROM users u
  LEFT JOIN organizations o ON u.organization_id = o.id
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Determine approval requirements based on requester role
  IF v_role IN ('Doctor', 'doctor') THEN
    -- Doctors need at least 1 other doctor approval
    v_requires_doctor := true;
    v_requires_admin := false;
    v_required_count := 1;
  ELSIF v_role IN ('Admin', 'admin') THEN
    -- Admins need at least 1 doctor approval
    v_requires_doctor := true;
    v_requires_admin := false;
    v_required_count := 1;
  ELSE
    -- Other roles need Admin + 1 Doctor approval
    v_requires_admin := true;
    v_requires_doctor := true;
    v_required_count := 2;
  END IF;
  
  -- Set expiration (24 hours from now)
  v_expires_at := NOW() + INTERVAL '24 hours';
  
  -- Create the request
  INSERT INTO data_download_requests (
    organization_id,
    organization_name,
    requested_by_user_id,
    requested_by_username,
    requested_by_role,
    request_type,
    password_hash,
    requires_admin_approval,
    requires_doctor_approval,
    required_approval_count,
    request_reason,
    requested_data_scope,
    expires_at
  ) VALUES (
    v_org_id,
    v_org_name,
    v_user_id,
    v_username,
    v_role,
    p_request_type,
    p_password_hash,
    v_requires_admin,
    v_requires_doctor,
    v_required_count,
    p_request_reason,
    p_requested_data_scope,
    v_expires_at
  ) RETURNING id INTO v_request_id;
  
  RETURN json_build_object(
    'success', true,
    'request_id', v_request_id,
    'requires_admin_approval', v_requires_admin,
    'requires_doctor_approval', v_requires_doctor,
    'required_approval_count', v_required_count,
    'expires_at', v_expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_download_request TO authenticated;

