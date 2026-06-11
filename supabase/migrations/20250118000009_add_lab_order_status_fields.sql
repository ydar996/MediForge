-- ============================================
-- ADD LAB ORDER STATUS TRACKING FIELDS
-- ============================================
-- Purpose: Add fields to track lab order processing status
-- ============================================

-- Add lab-specific status tracking fields to orders table
-- These fields track the lab processing workflow separately from the general order status

-- Add in_process_at timestamp (when lab scientist starts processing)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS in_process_at TIMESTAMPTZ;

-- Add in_process_by (who started processing)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS in_process_by TEXT;

-- Add completed_at timestamp (when lab results are completed)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add completed_by (who completed the results)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS completed_by TEXT;

-- Add lab_status field for more granular lab-specific status tracking
-- Values: 'pending', 'in-process', 'completed', 'cancelled'
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS lab_status TEXT DEFAULT 'pending';

-- Create index for lab_status for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_lab_status ON orders(lab_status) WHERE type = 'lab';

-- Create index for completed_at for faster date-based queries
CREATE INDEX IF NOT EXISTS idx_orders_completed_at ON orders(completed_at) WHERE type = 'lab' AND status = 'completed';

-- Update existing lab orders to have lab_status = 'pending' if status is 'Generated'
UPDATE orders 
SET lab_status = 'pending' 
WHERE type = 'lab' 
AND status = 'Generated' 
AND (lab_status IS NULL OR lab_status = '');

-- Update existing lab orders to have lab_status = 'completed' if status is 'completed'
UPDATE orders 
SET lab_status = 'completed' 
WHERE type = 'lab' 
AND status = 'completed' 
AND (lab_status IS NULL OR lab_status = '');

-- Verify the changes
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'orders'
AND column_name IN ('in_process_at', 'in_process_by', 'completed_at', 'completed_by', 'lab_status')
ORDER BY column_name;


