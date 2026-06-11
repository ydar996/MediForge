-- Ensure email column exists in users table
-- This migration fixes the "Could not find the 'email' column" error during registration

-- Add email column if it doesn't exist
DO $$
BEGIN
  -- Check if email column exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'email'
  ) THEN
    -- Add email column
    ALTER TABLE users ADD COLUMN email TEXT;
    
    -- Make it unique (if not already)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
    
    -- Update existing rows to have email based on username (if email is null)
    UPDATE users 
    SET email = username || '@mediforge.app'
    WHERE email IS NULL OR email = '';
    
    -- Now make it NOT NULL after populating existing rows
    ALTER TABLE users ALTER COLUMN email SET NOT NULL;
    
    RAISE NOTICE 'Email column added to users table';
  ELSE
    RAISE NOTICE 'Email column already exists in users table';
  END IF;
END $$;

-- Verify the column exists
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users' 
AND column_name = 'email';






