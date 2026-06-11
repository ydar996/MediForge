-- Revert username to global uniqueness
-- This migration reverts the organization-scoped username constraint
-- and restores global username uniqueness
-- 
-- IMPORTANT: This migration handles duplicate usernames by renaming them
-- to ensure uniqueness before applying the constraint

-- Step 1: Identify and resolve duplicate usernames
-- For each duplicate username, keep the oldest user (by created_at) and rename the others
DO $$
DECLARE
  dup_username_record RECORD;
  user_record RECORD;
  new_username TEXT;
  counter INTEGER;
  base_username TEXT;
BEGIN
  -- Find all usernames that appear more than once
  FOR dup_username_record IN
    SELECT username, COUNT(*) as count
    FROM users
    GROUP BY username
    HAVING COUNT(*) > 1
    ORDER BY username
  LOOP
    RAISE NOTICE 'Found duplicate username: % (appears % times)', dup_username_record.username, dup_username_record.count;
    
    base_username := dup_username_record.username;
    
    -- For each duplicate username, keep the first one (oldest by created_at) and rename the rest
    counter := 1;
    FOR user_record IN
      SELECT id, username, organization_id, created_at
      FROM users
      WHERE username = base_username
      ORDER BY created_at ASC, id ASC
    LOOP
      IF counter = 1 THEN
        -- Keep the first (oldest) user's username as-is
        RAISE NOTICE 'Keeping username "%" for user % (oldest, created: %)', user_record.username, user_record.id, user_record.created_at;
        counter := counter + 1;
      ELSE
        -- Rename subsequent duplicates by appending organization ID (first 8 chars) and counter
        new_username := base_username || '-' || 
                       SUBSTRING(REPLACE(user_record.organization_id::TEXT, '-', ''), 1, 8) || 
                       '-' || counter::TEXT;
        
        -- Ensure the new username doesn't already exist
        WHILE EXISTS (SELECT 1 FROM users WHERE username = new_username) LOOP
          counter := counter + 1;
          new_username := base_username || '-' || 
                         SUBSTRING(REPLACE(user_record.organization_id::TEXT, '-', ''), 1, 8) || 
                         '-' || counter::TEXT;
        END LOOP;
        
        -- Update the username
        UPDATE users
        SET username = new_username,
            updated_at = NOW()
        WHERE id = user_record.id;
        
        RAISE NOTICE 'Renamed user % username from "%" to "%" (org: %)', user_record.id, base_username, new_username, user_record.organization_id;
        counter := counter + 1;
      END IF;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '✅ All duplicate usernames resolved';
END $$;

-- Step 2: Verify no duplicates remain
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT username
    FROM users
    GROUP BY username
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Still have % duplicate username(s) after resolution. Please check manually.', duplicate_count;
  ELSE
    RAISE NOTICE '✅ Verified: No duplicate usernames remain';
  END IF;
END $$;

-- Step 3: Drop the composite UNIQUE constraint on (username, organization_id)
DO $$
BEGIN
  -- Find and drop the composite unique constraint
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'users_username_organization_unique' 
    AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_username_organization_unique;
    RAISE NOTICE 'Dropped composite unique constraint on (username, organization_id)';
  ELSE
    RAISE NOTICE 'Composite constraint does not exist (may have been dropped already)';
  END IF;
END $$;

-- Step 4: Create a global UNIQUE constraint on username
-- This ensures usernames are unique across all organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'users_username_key' 
    AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users 
    ADD CONSTRAINT users_username_key 
    UNIQUE (username);
    RAISE NOTICE 'Created global unique constraint on username';
  ELSE
    RAISE NOTICE 'Global unique constraint already exists';
  END IF;
END $$;

-- Step 5: Verify the constraint exists
DO $$
DECLARE
  constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'users_username_key' 
    AND conrelid = 'users'::regclass
  ) INTO constraint_exists;
  
  IF constraint_exists THEN
    RAISE NOTICE '✅ Global username uniqueness constraint verified';
  ELSE
    RAISE WARNING '⚠️ Global username uniqueness constraint not found';
  END IF;
END $$;
