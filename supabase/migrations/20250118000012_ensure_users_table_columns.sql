-- ============================================
-- ENSURE USERS TABLE HAS ALL REQUIRED COLUMNS
-- ============================================
-- Purpose: Ensure all columns needed for registration exist
-- This eliminates the need for "graceful handling" of missing columns
-- ============================================

-- 1. Ensure email column exists with proper constraints
DO $$
BEGIN
  -- Check if email column exists in public.users (not auth.users)
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'users' 
      AND column_name = 'email'
  ) THEN
    -- Add email column
    ALTER TABLE users ADD COLUMN email TEXT;
    
    -- Create unique index (partial, allows nulls)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique 
    ON users(email) WHERE email IS NOT NULL;
    
    -- Update existing rows to have email based on username
    UPDATE users 
    SET email = username || '@mediforge.app'
    WHERE email IS NULL OR email = '';
    
    -- Make email NOT NULL after populating existing rows
    ALTER TABLE users ALTER COLUMN email SET NOT NULL;
    
    RAISE NOTICE 'Added email column to users table';
  ELSE
    RAISE NOTICE 'Email column already exists';
  END IF;
END $$;

-- 2. Ensure license_number column exists (NOT medical_license_number)
DO $$
BEGIN
  -- Check if license_number column exists in public.users
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'users' 
      AND column_name = 'license_number'
  ) THEN
    -- Add license_number column
    ALTER TABLE users ADD COLUMN license_number TEXT;
    RAISE NOTICE 'Added license_number column to users table';
  ELSE
    RAISE NOTICE 'license_number column already exists';
  END IF;
  
  -- Check if old medical_license_number column exists and migrate data
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'users' 
      AND column_name = 'medical_license_number'
  ) THEN
    -- Migrate data from medical_license_number to license_number
    UPDATE users 
    SET license_number = medical_license_number 
    WHERE license_number IS NULL 
    AND medical_license_number IS NOT NULL;
    
    -- Drop the old column
    ALTER TABLE users DROP COLUMN IF EXISTS medical_license_number;
    
    RAISE NOTICE 'Migrated data from medical_license_number to license_number and dropped old column';
  END IF;
END $$;

-- 3. Ensure gender column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'users' 
      AND column_name = 'gender'
  ) THEN
    ALTER TABLE users ADD COLUMN gender TEXT DEFAULT 'Male';
    RAISE NOTICE 'Added gender column to users table';
  ELSE
    RAISE NOTICE 'Gender column already exists';
  END IF;
END $$;

-- 4. Ensure all other standard columns exist
DO $$
BEGIN
  -- phone
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'users' AND column_name = 'phone'
  ) THEN
    ALTER TABLE users ADD COLUMN phone TEXT;
  END IF;
  
  -- specialization
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'users' AND column_name = 'specialization'
  ) THEN
    ALTER TABLE users ADD COLUMN specialization TEXT;
  END IF;
  
  -- is_active
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'users' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
  
  -- last_login
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'users' AND column_name = 'last_login'
  ) THEN
    ALTER TABLE users ADD COLUMN last_login TIMESTAMPTZ;
  END IF;
  
  -- preferences
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'users' AND column_name = 'preferences'
  ) THEN
    ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}';
  END IF;
  
  -- created_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'users' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE users ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  
  -- updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'users' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE users ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 5. Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);

-- 6. Verify all columns exist in public.users table (not auth.users)
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
ORDER BY ordinal_position;

-- ============================================
-- ✅ USERS TABLE COLUMNS VERIFIED!
-- ============================================
-- All required columns for registration now exist:
-- - email (TEXT, NOT NULL, UNIQUE)
-- - license_number (TEXT, nullable)
-- - gender (TEXT, default 'Male')
-- - All other standard columns
-- ============================================

