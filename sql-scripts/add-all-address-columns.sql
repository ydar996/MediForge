-- Add address columns to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS address_line1 TEXT,
ADD COLUMN IF NOT EXISTS address_line2 TEXT;

-- Verify organizations columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'organizations' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Note: patients table should already have address columns from previous migration
-- But let's verify they exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'patients' 
  AND table_schema = 'public'
  AND column_name LIKE '%address%'
ORDER BY ordinal_position;



