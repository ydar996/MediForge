-- ============================================
-- ADD LAB ORDER PAYMENT TRACKING FIELDS
-- ============================================
-- Purpose: Add fields to track payment status and invoice linking for lab orders
-- Safe to run: Uses IF NOT EXISTS to prevent errors if columns already exist
-- ============================================

-- Add invoice_id to link lab order to invoice (nullable, so existing orders are unaffected)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS invoice_id TEXT;

-- Add payment_status field for lab order payment tracking
-- Default value 'unpaid' ensures existing orders get a safe default
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';

-- Create index for invoice_id for faster lookups (only on non-null values)
CREATE INDEX IF NOT EXISTS idx_orders_invoice_id ON orders(invoice_id) WHERE invoice_id IS NOT NULL;

-- Create index for payment_status for faster queries (only on lab orders)
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status) WHERE type = 'lab';

-- Update existing lab orders to have payment_status = 'unpaid' if not set
-- This is safe because it only updates rows where payment_status is NULL or empty string
-- It will NOT overwrite any existing payment_status values
UPDATE orders 
SET payment_status = 'unpaid' 
WHERE type = 'lab' 
AND (payment_status IS NULL OR payment_status = '');
