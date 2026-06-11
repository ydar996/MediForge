-- Create orders table for cross-device synchronization
-- This table stores all lab and imaging orders with unique serial numbers

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  serial_number VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('lab', 'imaging')),
  patient_id VARCHAR(50) NOT NULL,
  visit_date DATE NOT NULL,
  selected_items JSONB,
  no_items_checked BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'Generated',
  html_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255),
  organization_id UUID REFERENCES organizations(id),
  timestamp TIMESTAMP WITH TIME ZONE,
  results JSONB,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by VARCHAR(255),
  
  -- Indexes for performance
  INDEX idx_orders_serial_number (serial_number),
  INDEX idx_orders_patient_id (patient_id),
  INDEX idx_orders_visit_date (visit_date),
  INDEX idx_orders_organization_id (organization_id),
  INDEX idx_orders_created_at (created_at),
  INDEX idx_orders_type (type)
);

-- Add RLS (Row Level Security) policies
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see orders from their organization
CREATE POLICY "Users can view orders from their organization" ON orders
  FOR SELECT USING (
    organization_id IN (
      SELECT o.id FROM organizations o
      JOIN users u ON u.organization_id = o.id
      WHERE u.id = auth.uid()
    )
  );

-- Policy: Users can insert orders for their organization
CREATE POLICY "Users can insert orders for their organization" ON orders
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT o.id FROM organizations o
      JOIN users u ON u.organization_id = o.id
      WHERE u.id = auth.uid()
    )
  );

-- Policy: Users can update orders from their organization
CREATE POLICY "Users can update orders from their organization" ON orders
  FOR UPDATE USING (
    organization_id IN (
      SELECT o.id FROM organizations o
      JOIN users u ON u.organization_id = o.id
      WHERE u.id = auth.uid()
    )
  );

-- Policy: Users can delete orders from their organization (soft delete)
CREATE POLICY "Users can delete orders from their organization" ON orders
  FOR DELETE USING (
    organization_id IN (
      SELECT o.id FROM organizations o
      JOIN users u ON u.organization_id = o.id
      WHERE u.id = auth.uid()
    )
  );

-- Add audit trail functionality
CREATE OR REPLACE FUNCTION audit_orders()
RETURNS TRIGGER AS $$
BEGIN
  -- Log order changes for audit trail
  INSERT INTO audit_log (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    user_id,
    timestamp
  ) VALUES (
    'orders',
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW) END,
    auth.uid(),
    NOW()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for audit trail
CREATE TRIGGER orders_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION audit_orders();

-- Add comments for documentation
COMMENT ON TABLE orders IS 'Stores all lab and imaging orders with unique serial numbers for traceability';
COMMENT ON COLUMN orders.serial_number IS 'Unique serial number format: TYPE-PATIENTID-TIMESTAMP-RANDOM';
COMMENT ON COLUMN orders.type IS 'Order type: lab or imaging';
COMMENT ON COLUMN orders.selected_items IS 'JSON array of selected test items';
COMMENT ON COLUMN orders.html_content IS 'Generated HTML content for the order';
COMMENT ON COLUMN orders.results IS 'JSON array of attached results';
COMMENT ON COLUMN orders.deleted_at IS 'Soft delete timestamp';
COMMENT ON COLUMN orders.deleted_by IS 'User who deleted the order';






