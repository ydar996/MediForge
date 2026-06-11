-- Fix RLS Policies for Rooms, Beds, and Admissions Tables
-- The policies were using the wrong column (id instead of auth_user_id)
-- This fixes the "new row violates row-level security policy" error

-- ============================================
-- ROOMS TABLE - Fix RLS Policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view rooms from their organization" ON rooms;
DROP POLICY IF EXISTS "Users can insert rooms for their organization" ON rooms;
DROP POLICY IF EXISTS "Users can update rooms from their organization" ON rooms;
DROP POLICY IF EXISTS "Users can delete rooms from their organization" ON rooms;

-- Rooms: Users can only see rooms from their organization
CREATE POLICY "Users can view rooms from their organization"
    ON rooms FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
        OR
        -- Platform admins can see all
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_user_id = auth.uid()
            AND role IN ('PlatformOwner', 'PlatformAdmin')
        )
    );

-- Rooms: Users can insert rooms for their organization
CREATE POLICY "Users can insert rooms for their organization"
    ON rooms FOR INSERT
    TO authenticated
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- Rooms: Users can update rooms from their organization
CREATE POLICY "Users can update rooms from their organization"
    ON rooms FOR UPDATE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- Rooms: Users can delete rooms from their organization
CREATE POLICY "Users can delete rooms from their organization"
    ON rooms FOR DELETE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- ============================================
-- BEDS TABLE - Fix RLS Policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view beds from their organization" ON beds;
DROP POLICY IF EXISTS "Users can insert beds for their organization" ON beds;
DROP POLICY IF EXISTS "Users can update beds from their organization" ON beds;
DROP POLICY IF EXISTS "Users can delete beds from their organization" ON beds;

-- Beds: Users can only see beds from their organization
CREATE POLICY "Users can view beds from their organization"
    ON beds FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
        OR
        -- Platform admins can see all
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_user_id = auth.uid()
            AND role IN ('PlatformOwner', 'PlatformAdmin')
        )
    );

-- Beds: Users can insert beds for their organization
CREATE POLICY "Users can insert beds for their organization"
    ON beds FOR INSERT
    TO authenticated
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- Beds: Users can update beds from their organization
CREATE POLICY "Users can update beds from their organization"
    ON beds FOR UPDATE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- Beds: Users can delete beds from their organization
CREATE POLICY "Users can delete beds from their organization"
    ON beds FOR DELETE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- ============================================
-- ADMISSIONS TABLE - Fix RLS Policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view admissions from their organization" ON admissions;
DROP POLICY IF EXISTS "Users can insert admissions for their organization" ON admissions;
DROP POLICY IF EXISTS "Users can update admissions from their organization" ON admissions;
DROP POLICY IF EXISTS "Users can delete admissions from their organization" ON admissions;

-- Admissions: Users can only see admissions from their organization
CREATE POLICY "Users can view admissions from their organization"
    ON admissions FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
        OR
        -- Platform admins can see all
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_user_id = auth.uid()
            AND role IN ('PlatformOwner', 'PlatformAdmin')
        )
    );

-- Admissions: Users can insert admissions for their organization
CREATE POLICY "Users can insert admissions for their organization"
    ON admissions FOR INSERT
    TO authenticated
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- Admissions: Users can update admissions from their organization
CREATE POLICY "Users can update admissions from their organization"
    ON admissions FOR UPDATE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- Admissions: Users can delete admissions from their organization
CREATE POLICY "Users can delete admissions from their organization"
    ON admissions FOR DELETE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- ============================================
-- VERIFICATION
-- ============================================
-- After running this script, test by:
-- 1. Going to https://mediforge.netlify.app/configure-inpatient-facilities
-- 2. Try adding a room - should work without RLS error
-- 3. Try adding a bed - should work without RLS error

