-- Enable Supabase Realtime for audit_logs so the Security Operations dashboard
-- can receive live INSERT events without polling only.
-- Docs: https://supabase.com/docs/guides/realtime

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'audit_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;
  END IF;
END $$;
