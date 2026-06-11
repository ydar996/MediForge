-- Migration: Add Manual Patient Numbering Support
-- Purpose: Enable organizations to use custom patient numbers instead of auto-generated ones
-- Date: 2025-01-20

-- Note: The organizations table already has a 'settings' JSONB field
-- We'll store the toggle state there: settings->>'manual_patient_numbering_enabled' = 'true'/'false'

-- No schema changes needed - using existing settings JSONB field
-- This migration file documents the feature and ensures settings field exists

-- Verify settings field exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'organizations' 
        AND column_name = 'settings'
    ) THEN
        ALTER TABLE organizations ADD COLUMN settings JSONB DEFAULT '{}';
    END IF;
END $$;

-- Add comment to document the feature
COMMENT ON COLUMN organizations.settings IS 'Organization settings JSONB. Use settings->>''manual_patient_numbering_enabled'' to store boolean toggle for manual patient numbering feature.';




















