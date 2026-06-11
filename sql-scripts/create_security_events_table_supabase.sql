-- Create security_events table for platform-wide security monitoring
-- Run this in your Supabase SQL Editor

-- Create security_events table
CREATE TABLE IF NOT EXISTS security_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  details JSONB,
  user_info JSONB,
  session_info JSONB,
  browser_info JSONB,
  location_info JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  organization_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_organization_id ON security_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_security_events_user_info ON security_events USING GIN(user_info);

-- Enable Row Level Security
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Create policies for organization-based access
-- Platform administrators can see all events (simplified policy)
CREATE POLICY "Platform admins can view all security events" ON security_events
  FOR SELECT USING (
    auth.jwt() ->> 'email' IN ('yinka@eworkchop.com', 'ydar101', 'ydar202')
  );

-- Allow all authenticated users to view security events (for now)
-- This can be restricted later based on organization membership
CREATE POLICY "Authenticated users can view security events" ON security_events
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow inserting security events (for logging)
CREATE POLICY "Allow inserting security events" ON security_events
  FOR INSERT WITH CHECK (true);

-- Add table comments
COMMENT ON TABLE security_events IS 'Stores security events for audit logging and monitoring';
COMMENT ON COLUMN security_events.event_type IS 'Type of security event (login_attempt, page_load, etc.)';
COMMENT ON COLUMN security_events.details IS 'Event-specific details in JSON format';
COMMENT ON COLUMN security_events.user_info IS 'User information at time of event';
COMMENT ON COLUMN security_events.session_info IS 'Session information';
COMMENT ON COLUMN security_events.browser_info IS 'Browser and device information';
COMMENT ON COLUMN security_events.location_info IS 'Geographic location information';
COMMENT ON COLUMN security_events.organization_id IS 'Organization ID for multi-tenant isolation';
