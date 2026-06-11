-- Create data_download_requests table and functions for secure download approval workflow
-- Run this script in Supabase SQL Editor

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS data_download_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  organization_name TEXT NOT NULL,
  requested_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_by_username TEXT NOT NULL,
  requested_by_role TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('backup', 'csv_export', 'full_export')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'expired')),
  
  -- Password verification (hashed)
  password_hash TEXT NOT NULL,
  password_verified BOOLEAN DEFAULT false,
  
  -- Approval requirements based on requester role
  requires_admin_approval BOOLEAN DEFAULT false,
  requires_doctor_approval BOOLEAN DEFAULT false,
  required_approval_count INTEGER DEFAULT 1,
  
  -- Approvals received
  admin_approvals JSONB DEFAULT '[]'::jsonb, -- Array of {approver_id, approver_username, approved_at}
  doctor_approvals JSONB DEFAULT '[]'::jsonb, -- Array of {approver_id, approver_username, approved_at}
  
  -- Request metadata
  request_reason TEXT,
  requested_data_scope TEXT, -- What data is being requested
  ip_address TEXT,
  user_agent TEXT,
  
  -- Timestamps
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Requests expire after 24 hours
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Download tracking
  download_count INTEGER DEFAULT 0,
  last_downloaded_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_download_requests_org ON data_download_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_download_requests_status ON data_download_requests(status);
CREATE INDEX IF NOT EXISTS idx_download_requests_requested_by ON data_download_requests(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_download_requests_expires ON data_download_requests(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_download_requests_created ON data_download_requests(created_at DESC);

-- Enable Row Level Security
ALTER TABLE data_download_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own download requests" ON data_download_requests;
DROP POLICY IF EXISTS "Admins and Doctors can view org requests" ON data_download_requests;
DROP POLICY IF EXISTS "Users can create download requests" ON data_download_requests;
DROP POLICY IF EXISTS "Admins and Doctors can approve requests" ON data_download_requests;

-- Users can view their own requests
CREATE POLICY "Users can view their own download requests" ON data_download_requests
  FOR SELECT USING (
    requested_by_user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1)
  );

-- Admins and Doctors can view all requests for their organization
CREATE POLICY "Admins and Doctors can view org requests" ON data_download_requests
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE auth_user_id = auth.uid() 
      AND role IN ('Admin', 'admin', 'Doctor', 'doctor')
    )
  );

-- Users can create their own requests
CREATE POLICY "Users can create download requests" ON data_download_requests
  FOR INSERT WITH CHECK (
    requested_by_user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid() LIMIT 1)
  );

-- Admins and Doctors can update requests (for approvals)
CREATE POLICY "Admins and Doctors can approve requests" ON data_download_requests
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE auth_user_id = auth.uid() 
      AND role IN ('Admin', 'admin', 'Doctor', 'doctor')
    )
  );

-- Add table comments
COMMENT ON TABLE data_download_requests IS 'Tracks data download requests requiring approval workflow';
COMMENT ON COLUMN data_download_requests.status IS 'Request status: pending, approved, rejected, completed, expired';
COMMENT ON COLUMN data_download_requests.admin_approvals IS 'JSON array of admin approvals';
COMMENT ON COLUMN data_download_requests.doctor_approvals IS 'JSON array of doctor approvals';

-- Function to automatically expire old pending requests
CREATE OR REPLACE FUNCTION expire_old_download_requests()
RETURNS void AS $$
BEGIN
  UPDATE data_download_requests
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create RPC function to create a download request
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

-- Create RPC function to approve a download request
CREATE OR REPLACE FUNCTION approve_download_request(
  p_request_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_username TEXT;
  v_role TEXT;
  v_org_id UUID;
  v_request RECORD;
  v_admin_count INTEGER;
  v_doctor_count INTEGER;
  v_total_approvals INTEGER;
  v_approval_entry JSONB;
BEGIN
  -- Get current user info
  SELECT id, username, role, organization_id
  INTO v_user_id, v_username, v_role, v_org_id
  FROM users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Get the request
  SELECT * INTO v_request
  FROM data_download_requests
  WHERE id = p_request_id
    AND organization_id = v_org_id;
  
  IF v_request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Request not found or access denied');
  END IF;
  
  IF v_request.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Request is not pending');
  END IF;
  
  IF v_request.expires_at < NOW() THEN
    UPDATE data_download_requests SET status = 'expired' WHERE id = p_request_id;
    RETURN json_build_object('success', false, 'error', 'Request has expired');
  END IF;
  
  -- Check if user has already approved
  IF v_role IN ('Admin', 'admin') THEN
    IF v_request.admin_approvals @> jsonb_build_array(jsonb_build_object('approver_id', v_user_id::text)) THEN
      RETURN json_build_object('success', false, 'error', 'You have already approved this request');
    END IF;
    
    -- Add admin approval
    v_approval_entry := jsonb_build_object(
      'approver_id', v_user_id::text,
      'approver_username', v_username,
      'approved_at', NOW()::text
    );
    
    UPDATE data_download_requests
    SET admin_approvals = admin_approvals || jsonb_build_array(v_approval_entry),
        updated_at = NOW()
    WHERE id = p_request_id;
    
  ELSIF v_role IN ('Doctor', 'doctor') THEN
    IF v_request.doctor_approvals @> jsonb_build_array(jsonb_build_object('approver_id', v_user_id::text)) THEN
      RETURN json_build_object('success', false, 'error', 'You have already approved this request');
    END IF;
    
    -- Add doctor approval
    v_approval_entry := jsonb_build_object(
      'approver_id', v_user_id::text,
      'approver_username', v_username,
      'approved_at', NOW()::text
    );
    
    UPDATE data_download_requests
    SET doctor_approvals = doctor_approvals || jsonb_build_array(v_approval_entry),
        updated_at = NOW()
    WHERE id = p_request_id;
  ELSE
    RETURN json_build_object('success', false, 'error', 'Only Admins and Doctors can approve requests');
  END IF;
  
  -- Check if approval requirements are met
  SELECT 
    jsonb_array_length(COALESCE(admin_approvals, '[]'::jsonb)),
    jsonb_array_length(COALESCE(doctor_approvals, '[]'::jsonb))
  INTO v_admin_count, v_doctor_count
  FROM data_download_requests
  WHERE id = p_request_id;
  
  v_total_approvals := v_admin_count + v_doctor_count;
  
  -- Check if requirements are met
  IF v_request.requires_admin_approval AND v_admin_count < 1 THEN
    RETURN json_build_object(
      'success', true,
      'approved', false,
      'message', 'Admin approval received. Waiting for required approvals.',
      'admin_approvals', v_admin_count,
      'doctor_approvals', v_doctor_count,
      'required', v_request.required_approval_count
    );
  END IF;
  
  IF v_request.requires_doctor_approval AND v_doctor_count < v_request.required_approval_count THEN
    RETURN json_build_object(
      'success', true,
      'approved', false,
      'message', 'Approval received. Waiting for required approvals.',
      'admin_approvals', v_admin_count,
      'doctor_approvals', v_doctor_count,
      'required', v_request.required_approval_count
    );
  END IF;
  
  -- All requirements met - approve the request
  UPDATE data_download_requests
  SET status = 'approved',
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_request_id;
  
  RETURN json_build_object(
    'success', true,
    'approved', true,
    'message', 'Request approved. Download can now proceed.',
    'admin_approvals', v_admin_count,
    'doctor_approvals', v_doctor_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC function to get pending requests for approval
CREATE OR REPLACE FUNCTION get_pending_download_requests()
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_org_id UUID;
  v_requests JSON;
BEGIN
  -- Get current user info
  SELECT id, role, organization_id
  INTO v_user_id, v_role, v_org_id
  FROM users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Only Admins and Doctors can see requests
  IF v_role NOT IN ('Admin', 'admin', 'Doctor', 'doctor') THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;
  
  -- Get pending requests for this organization
  SELECT json_agg(
    json_build_object(
      'id', id,
      'requested_by_username', requested_by_username,
      'requested_by_role', requested_by_role,
      'request_type', request_type,
      'request_reason', request_reason,
      'requested_data_scope', requested_data_scope,
      'requested_at', requested_at,
      'expires_at', expires_at,
      'requires_admin_approval', requires_admin_approval,
      'requires_doctor_approval', requires_doctor_approval,
      'admin_approvals', admin_approvals,
      'doctor_approvals', doctor_approvals,
      'required_approval_count', required_approval_count
    )
    ORDER BY requested_at DESC
  )
  INTO v_requests
  FROM data_download_requests
  WHERE organization_id = v_org_id
    AND status = 'pending'
    AND expires_at > NOW();
  
  RETURN json_build_object(
    'success', true,
    'requests', COALESCE(v_requests, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC function to mark download as completed
CREATE OR REPLACE FUNCTION mark_download_completed(
  p_request_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_request RECORD;
BEGIN
  -- Get current user info
  SELECT id INTO v_user_id
  FROM users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Get the request
  SELECT * INTO v_request
  FROM data_download_requests
  WHERE id = p_request_id
    AND requested_by_user_id = v_user_id
    AND status = 'approved';
  
  IF v_request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Request not found or not approved');
  END IF;
  
  -- Update download tracking
  UPDATE data_download_requests
  SET status = 'completed',
      completed_at = NOW(),
      download_count = download_count + 1,
      last_downloaded_at = NOW(),
      updated_at = NOW()
  WHERE id = p_request_id;
  
  RETURN json_build_object('success', true, 'message', 'Download completed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION create_download_request TO authenticated;
GRANT EXECUTE ON FUNCTION approve_download_request TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_download_requests TO authenticated;
GRANT EXECUTE ON FUNCTION mark_download_completed TO authenticated;

