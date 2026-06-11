-- Add missing address column to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS address TEXT;

-- Also add other potentially missing columns that might be useful
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS address_line1 TEXT,
ADD COLUMN IF NOT EXISTS address_line2 TEXT;

-- Verify the columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'organizations' 
  AND table_schema = 'public'
ORDER BY ordinal_position;



