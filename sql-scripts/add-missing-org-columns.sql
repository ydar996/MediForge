-- ============================================
-- Add Missing Organization Columns (OPTIONAL)
-- ============================================
-- Purpose: Add subscription and limit columns to organizations table
-- Run this in: Supabase Dashboard → SQL Editor
-- 
-- Only run this if you want these extra columns for tracking
-- subscriptions and limits. Otherwise, use the FIXED version.
-- ============================================

-- Add subscription-related columns
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'free_trial',
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS max_patients INTEGER DEFAULT 100;

-- Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'organizations'
ORDER BY ordinal_position;

-- Now you can use the original SQL script if you want
-- Or just stick with the FIXED version (simpler)

-- ============================================
-- Note: These columns are NOT required for Day 2
-- They're just nice-to-have for future features
-- ============================================



