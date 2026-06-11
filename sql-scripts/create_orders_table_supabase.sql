-- Create orders table for cross-device synchronization
-- Simplified version for Supabase compatibility
-- Run this in your Supabase SQL Editor

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  serial_number TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('lab', 'imaging')),
  patient_id TEXT NOT NULL,
  visit_date DATE NOT NULL,
  selected_items JSONB,
  no_items_checked BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'Generated',
  html_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  organization_id UUID,
  timestamp TIMESTAMPTZ,
  results JSONB,
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_serial_number ON orders (serial_number);
CREATE INDEX IF NOT EXISTS idx_orders_patient_id ON orders (patient_id);
CREATE INDEX IF NOT EXISTS idx_orders_visit_date ON orders (visit_date);
CREATE INDEX IF NOT EXISTS idx_orders_organization_id ON orders (organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at);
CREATE INDEX IF NOT EXISTS idx_orders_type ON orders (type);

-- Enable Row Level Security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create policies for organization-based access
-- Note: These policies assume you have a users table with organization_id
-- Adjust the policy conditions based on your actual schema

-- Policy: Users can view orders from their organization
CREATE POLICY "Users can view orders from their organization" ON orders
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert orders for their organization
CREATE POLICY "Users can insert orders for their organization" ON orders
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can update orders from their organization
CREATE POLICY "Users can update orders from their organization" ON orders
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete orders from their organization (soft delete)
CREATE POLICY "Users can delete orders from their organization" ON orders
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid()
    )
  );

-- Add table comments
COMMENT ON TABLE orders IS 'Stores all lab and imaging orders with unique serial numbers for traceability';
COMMENT ON COLUMN orders.serial_number IS 'Unique serial number format: TYPE-PATIENTID-TIMESTAMP-RANDOM';
COMMENT ON COLUMN orders.type IS 'Order type: lab or imaging';
COMMENT ON COLUMN orders.selected_items IS 'JSON array of selected test items';
COMMENT ON COLUMN orders.html_content IS 'Generated HTML content for the order';
COMMENT ON COLUMN orders.results IS 'JSON array of attached results';
COMMENT ON COLUMN orders.deleted_at IS 'Soft delete timestamp';
COMMENT ON COLUMN orders.deleted_by IS 'User who deleted the order';






