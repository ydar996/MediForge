-- ============================================
-- ADD updated_at COLUMN TO ORDERS TABLE
-- ============================================
-- Purpose: Add updated_at column to track when orders are modified
-- Issue: Code tries to update updated_at but column doesn't exist
-- ============================================

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'orders' 
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    
    -- Set updated_at for existing rows
    UPDATE orders SET updated_at = created_at WHERE updated_at IS NULL;
    
    RAISE NOTICE 'Added updated_at column to orders table';
  ELSE
    RAISE NOTICE 'updated_at column already exists';
  END IF;
END $$;

-- Create a trigger function to automatically update updated_at on row changes
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS trigger_update_orders_updated_at ON orders;
CREATE TRIGGER trigger_update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_orders_updated_at();

-- Verify the column was added
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
  AND column_name = 'updated_at';

-- ============================================
-- ✅ updated_at COLUMN ADDED!
-- ============================================
-- The orders table now has an updated_at column that automatically
-- updates whenever a row is modified. This fixes the "Start Processing"
-- button error.
-- ============================================

