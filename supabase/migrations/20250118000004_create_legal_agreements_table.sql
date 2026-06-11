-- ============================================
-- LEGAL AGREEMENTS TABLE
-- ============================================
-- Purpose: Store signed legal agreements (BAA, Service Agreement) for all users
-- ============================================

CREATE TABLE IF NOT EXISTS legal_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id),
    agreement_type TEXT NOT NULL, -- 'service_agreement', 'baa', 'dpa'
    agreement_version TEXT NOT NULL DEFAULT '2025-11-18', -- Version date
    user_name TEXT NOT NULL, -- Full name of person signing
    user_role TEXT NOT NULL, -- Role at time of signing
    user_email TEXT NOT NULL, -- Email at time of signing
    ip_address TEXT, -- IP address when signed
    user_agent TEXT, -- Browser/device info
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    agreement_text TEXT, -- Full text of agreement (for record keeping)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one agreement per user per type per version
    UNIQUE(user_id, agreement_type, agreement_version)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_legal_agreements_user ON legal_agreements(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_agreements_org ON legal_agreements(organization_id);
CREATE INDEX IF NOT EXISTS idx_legal_agreements_type ON legal_agreements(agreement_type);
CREATE INDEX IF NOT EXISTS idx_legal_agreements_signed_at ON legal_agreements(signed_at);

-- Row Level Security (RLS) policies
ALTER TABLE legal_agreements ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own legal agreements
CREATE POLICY "Users can view their own legal agreements" ON legal_agreements
    FOR SELECT
    USING (auth.uid() IN (SELECT auth_user_id FROM users WHERE id = legal_agreements.user_id));

-- Policy: Users can insert their own legal agreements (during registration)
CREATE POLICY "Users can insert their own legal agreements" ON legal_agreements
    FOR INSERT
    WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM users WHERE id = legal_agreements.user_id));

-- Policy: Organization admins can view all agreements for their organization
CREATE POLICY "Admins can view organization legal agreements" ON legal_agreements
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND role IN ('Admin', 'PlatformAdmin', 'PlatformOwner')
        )
    );

-- Policy: Platform admins can view ALL legal agreements (for compliance)
CREATE POLICY "Platform admins can view all legal agreements" ON legal_agreements
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE auth_user_id = auth.uid() 
            AND role IN ('PlatformAdmin', 'PlatformOwner')
        )
    );

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_legal_agreements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_legal_agreements_updated_at
    BEFORE UPDATE ON legal_agreements
    FOR EACH ROW
    EXECUTE FUNCTION update_legal_agreements_updated_at();

-- Add column to users table to track if user has signed required agreements
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS legal_agreements_accepted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS legal_agreements_accepted_at TIMESTAMPTZ;

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_users_legal_agreements_accepted ON users(legal_agreements_accepted);

COMMENT ON TABLE legal_agreements IS 'Stores signed legal agreements (BAA, Service Agreement, DPA) for all users';
COMMENT ON COLUMN legal_agreements.agreement_type IS 'Type of agreement: service_agreement, baa, dpa';
COMMENT ON COLUMN legal_agreements.agreement_version IS 'Version date of the agreement (YYYY-MM-DD format)';
COMMENT ON COLUMN legal_agreements.agreement_text IS 'Full text of the agreement at time of signing for record keeping';

