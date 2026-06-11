-- Purpose: Ensure audit_logs table has all important columns for comprehensive logging
-- This migration adds any missing columns that are important for audit tracking

-- Add missing columns if they don't exist (idempotent)
ALTER TABLE audit_logs 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS organization_name TEXT,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS user_name TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS details JSONB,
  ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Make username and action NOT NULL if they're not already (safely)
DO $$
BEGIN
  -- Only modify if the columns exist and are nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'audit_logs' 
      AND column_name = 'username' 
      AND is_nullable = 'YES'
  ) THEN
    -- Set default for existing NULL values first
    UPDATE audit_logs SET username = 'unknown' WHERE username IS NULL;
    ALTER TABLE audit_logs ALTER COLUMN username SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'audit_logs' 
      AND column_name = 'action' 
      AND is_nullable = 'YES'
  ) THEN
    -- Set default for existing NULL values first
    UPDATE audit_logs SET action = 'unknown_action' WHERE action IS NULL;
    ALTER TABLE audit_logs ALTER COLUMN action SET NOT NULL;
  END IF;
END $$;

-- Ensure timestamp has a default
ALTER TABLE audit_logs ALTER COLUMN timestamp SET DEFAULT NOW();

-- Create/update indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_username ON audit_logs(username);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_role ON audit_logs(role) WHERE role IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address) WHERE ip_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type) WHERE event_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_username ON audit_logs(organization_id, username) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_timestamp ON audit_logs(action, timestamp DESC);

-- Add helpful comments
COMMENT ON TABLE audit_logs IS 'Comprehensive audit log table for platform-wide activity tracking and compliance';
COMMENT ON COLUMN audit_logs.username IS 'Username who performed the action (NOT NULL)';
COMMENT ON COLUMN audit_logs.action IS 'Type of action performed (e.g., patient_created, user_login, login_failed) (NOT NULL)';
COMMENT ON COLUMN audit_logs.role IS 'User role at time of action (e.g., doctor, nurse, admin)';
COMMENT ON COLUMN audit_logs.organization_id IS 'Organization UUID where action occurred (can be NULL for platform-level actions)';
COMMENT ON COLUMN audit_logs.organization_name IS 'Denormalized organization name for easier querying';
COMMENT ON COLUMN audit_logs.event_type IS 'High-level event category (e.g., authentication, patient_data, billing)';
COMMENT ON COLUMN audit_logs.details IS 'Action-specific details in JSONB format for flexible storage';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of client making the request';
COMMENT ON COLUMN audit_logs.user_agent IS 'Browser/client user agent string';
COMMENT ON COLUMN audit_logs.timestamp IS 'When the action occurred (defaults to NOW())';

