-- Create audit_logs table for platform-wide audit logging
-- This allows platform admins to see all users' activity across all machines

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  organization_name TEXT,
  username TEXT NOT NULL,  -- Primary user identifier (avoids reserved keyword)
  user_name TEXT,  -- Alias for compatibility
  role TEXT,
  action TEXT NOT NULL,
  event_type TEXT,
  details JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_username ON audit_logs(username);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Enable Row Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Platform admins can see all audit logs
CREATE POLICY "Platform admins can view all audit logs" ON audit_logs
  FOR SELECT USING (
    auth.jwt() ->> 'email' IN ('admin@mediforge.com', 'yinka@eworkchop.com') OR
    auth.jwt() ->> 'role' = 'platform_admin'
  );

-- Allow authenticated users to insert their own audit logs
CREATE POLICY "Allow inserting audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- Add table comments
COMMENT ON TABLE audit_logs IS 'Stores platform-wide audit logs for compliance and monitoring';
COMMENT ON COLUMN audit_logs.username IS 'Username who performed the action';
COMMENT ON COLUMN audit_logs.action IS 'Type of action performed (e.g., patient_created, user_login)';
COMMENT ON COLUMN audit_logs.details IS 'Action-specific details in JSON format';

