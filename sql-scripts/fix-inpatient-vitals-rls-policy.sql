-- ============================================
-- Fix RLS Policies for inpatient_vitals table
-- ============================================
-- This script corrects the RLS policies to use auth_user_id instead of id for user lookup.
-- Run this in Supabase SQL Editor

-- ============================================
-- INPATIENT_VITALS TABLE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view inpatient vitals from their organization" ON inpatient_vitals;
DROP POLICY IF EXISTS "Users can insert inpatient vitals for their organization" ON inpatient_vitals;
DROP POLICY IF EXISTS "Users can update inpatient vitals from their organization" ON inpatient_vitals;
DROP POLICY IF EXISTS "Users can delete inpatient vitals from their organization" ON inpatient_vitals;

-- Create new policies using auth_user_id
CREATE POLICY "Users can view inpatient vitals from their organization"
    ON inpatient_vitals FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert inpatient vitals for their organization"
    ON inpatient_vitals FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update inpatient vitals from their organization"
    ON inpatient_vitals FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete inpatient vitals from their organization"
    ON inpatient_vitals FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- ============================================
-- SUCCESS!
-- ============================================

