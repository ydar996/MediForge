-- ============================================
-- Appointment Reminder System
-- ============================================
CREATE TABLE IF NOT EXISTS appointment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  
  -- Recipient: either staff (user_id) or patient (user_id from users where role='Patient')
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Reminder timing
  days_before INTEGER NOT NULL,  -- e.g. 14, 7, 6, 5, 4, 3, 2, 1
  reminder_type TEXT NOT NULL DEFAULT 'appointment_reminder',
  
  -- Status
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(appointment_id, user_id, days_before)
);

CREATE INDEX IF NOT EXISTS idx_appointment_reminders_org ON appointment_reminders(organization_id);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_appointment ON appointment_reminders(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_user ON appointment_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_sent ON appointment_reminders(sent_at);

-- RLS
ALTER TABLE appointment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view appointment reminders in their org"
  ON appointment_reminders FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Service role will insert (scheduled function bypasses RLS)
-- Allow org users to insert for their org (e.g. manual trigger)
CREATE POLICY "Users can insert appointment reminders in their org"
  ON appointment_reminders FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- 2. ORGANIZATION SETTINGS (reminder config)
-- Uses existing organizations.settings JSONB. Keys:
--   reminder_lead_days: 14 (default) - when to start reminders
--   daily_reminders_enabled: true - send daily in final 7 days
-- No schema change needed - settings already exists.
COMMENT ON COLUMN organizations.settings IS 'JSONB. Appointment reminders: reminder_lead_days (int), daily_reminders_enabled (bool)';
