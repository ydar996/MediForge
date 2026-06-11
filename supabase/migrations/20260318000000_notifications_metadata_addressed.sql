-- Add metadata and is_addressed to notifications for appointment reminders
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_addressed BOOLEAN DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS addressed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_addressed ON notifications(user_id, is_addressed) WHERE is_addressed = false;

COMMENT ON COLUMN notifications.metadata IS 'Extra data e.g. appointment_id, patient_id, patient_name for appointment_reminder type';
COMMENT ON COLUMN notifications.is_addressed IS 'User has taken appropriate action on this notification';
