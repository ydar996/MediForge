/*
  # Create Payment Receipts Table
  
  This migration creates the payment_receipts table for storing payment receipt uploads
  from organizations for subscription payments.
  
  ## Tables Created
  - payment_receipts: Stores receipt files uploaded by organizations for payment verification
*/

-- Create payment_receipts table
CREATE TABLE IF NOT EXISTS payment_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id TEXT NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    organization_name TEXT,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    base64_data TEXT NOT NULL, -- Base64 encoded file data
    file_data TEXT, -- Alias for base64_data (for compatibility)
    upload_date TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending_approval', -- pending_approval, approved, rejected
    approved_date TIMESTAMPTZ,
    approved_by TEXT,
    rejected_date TIMESTAMPTZ,
    rejected_by TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_receipts_payment_id ON payment_receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_organization_id ON payment_receipts(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_status ON payment_receipts(status);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_upload_date ON payment_receipts(upload_date DESC);

-- Enable RLS
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotent migration)
DROP POLICY IF EXISTS "Allow viewing payment receipts" ON payment_receipts;
DROP POLICY IF EXISTS "Platform admins can view all payment receipts" ON payment_receipts;
DROP POLICY IF EXISTS "Platform admins can update all payment receipts" ON payment_receipts;
DROP POLICY IF EXISTS "Organizations can insert their own payment receipts" ON payment_receipts;
DROP POLICY IF EXISTS "Organizations can view their own payment receipts" ON payment_receipts;

-- RLS Policy: Allow all authenticated users to view receipts
-- Platform admins will see all receipts (no filter in query)
-- Organizations will see their own receipts (filtered by organization_id in application logic)
-- This allows platform admins who authenticate via localStorage to still access receipts
CREATE POLICY "Allow viewing payment receipts"
    ON payment_receipts
    FOR SELECT
    TO authenticated
    USING (true);

-- RLS Policy: Platform admins can see all receipts (backup - more specific)
-- Check multiple ways: via users table, JWT email, or JWT role
CREATE POLICY "Platform admins can view all payment receipts"
    ON payment_receipts
    FOR SELECT
    USING (
        -- Check if user is platform admin via users table
        EXISTS (
            SELECT 1 FROM users
            WHERE (users.id = auth.uid() OR users.auth_user_id = auth.uid())
            AND (users.role = 'Platform Admin' OR users.role = 'PlatformOwner' OR users.role = 'platform_admin')
        )
        OR
        -- Check if authenticated user has platform admin email in JWT
        (auth.uid() IS NOT NULL AND auth.jwt() ->> 'email' IN ('yinka@eworkchop.com', 'ydar101', 'ydar202', 'platform@mediforge.com', 'ydar202@mediforge.com'))
        OR
        -- Check if JWT has platform admin role
        (auth.uid() IS NOT NULL AND auth.jwt() ->> 'role' IN ('platform_admin', 'Platform Admin', 'PlatformOwner'))
    );

-- RLS Policy: Platform admins can update all receipts (for approval/rejection)
CREATE POLICY "Platform admins can update all payment receipts"
    ON payment_receipts
    FOR UPDATE
    USING (
        -- Check if user is platform admin via users table
        EXISTS (
            SELECT 1 FROM users
            WHERE (users.id = auth.uid() OR users.auth_user_id = auth.uid())
            AND (users.role = 'Platform Admin' OR users.role = 'PlatformOwner' OR users.role = 'platform_admin')
        )
        OR
        -- Check if authenticated user has platform admin email in JWT
        (auth.uid() IS NOT NULL AND auth.jwt() ->> 'email' IN ('yinka@eworkchop.com', 'ydar101', 'ydar202', 'platform@mediforge.com', 'ydar202@mediforge.com'))
        OR
        -- Check if JWT has platform admin role
        (auth.uid() IS NOT NULL AND auth.jwt() ->> 'role' IN ('platform_admin', 'Platform Admin', 'PlatformOwner'))
    );

-- RLS Policy: Organizations can insert their own receipts
CREATE POLICY "Organizations can insert their own payment receipts"
    ON payment_receipts
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users
            WHERE (users.id = auth.uid() OR users.auth_user_id = auth.uid())
        )
    );

-- RLS Policy: Organizations can view their own receipts
CREATE POLICY "Organizations can view their own payment receipts"
    ON payment_receipts
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users
            WHERE (users.id = auth.uid() OR users.auth_user_id = auth.uid())
        )
    );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_payment_receipts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists (for idempotent migration)
DROP TRIGGER IF EXISTS update_payment_receipts_updated_at ON payment_receipts;

CREATE TRIGGER update_payment_receipts_updated_at
    BEFORE UPDATE ON payment_receipts
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_receipts_updated_at();

-- Add comment to table
COMMENT ON TABLE payment_receipts IS 'Stores payment receipt files uploaded by organizations for subscription payment verification';

