-- Add missing updated_at column to clinical_notes table
ALTER TABLE clinical_notes 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();


