-- Change username uniqueness from global to per-organization
-- This allows the same username to be used in different organizations

-- Step 1: Drop the existing global UNIQUE constraint on username
DO $$
BEGIN
  -- Find and drop the unique constraint on username
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'users_username_key' 
    AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_username_key;
    RAISE NOTICE 'Dropped global unique constraint on username';
  END IF;
END $$;

-- Step 2: Create a composite UNIQUE constraint on (username, organization_id)
-- This ensures usernames are unique within each organization, but can be reused across organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'users_username_organization_unique' 
    AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users 
    ADD CONSTRAINT users_username_organization_unique 
    UNIQUE (username, organization_id);
    RAISE NOTICE 'Created composite unique constraint on (username, organization_id)';
  END IF;
END $$;

-- Step 3: Verify the constraint was created
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'users'::regclass
AND conname = 'users_username_organization_unique';

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT users_username_organization_unique ON users IS 
'Ensures usernames are unique within each organization, but allows the same username to be used in different organizations';

