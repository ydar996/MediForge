-- Pharmacy Management System Tables
-- For tracking prescriptions, inventory, and dispensing

-- 1. PRESCRIPTION STATUS TRACKING (extends existing prescriptions)
-- Add pharmacy-specific status column if it doesn't exist
ALTER TABLE prescriptions 
ADD COLUMN IF NOT EXISTS pharmacy_status TEXT DEFAULT 'pending' CHECK (pharmacy_status IN ('pending', 'in-process', 'filled', 'cancelled'));

ALTER TABLE prescriptions 
ADD COLUMN IF NOT EXISTS sent_to_pharmacy_at TIMESTAMPTZ;

ALTER TABLE prescriptions 
ADD COLUMN IF NOT EXISTS filled_at TIMESTAMPTZ;

ALTER TABLE prescriptions 
ADD COLUMN IF NOT EXISTS filled_by_user_id UUID REFERENCES users(id);

ALTER TABLE prescriptions 
ADD COLUMN IF NOT EXISTS pharmacy_notes TEXT;

-- 2. MEDICATION INVENTORY
CREATE TABLE IF NOT EXISTS medication_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Medication details (from prescription parameters)
  medication_name TEXT NOT NULL,
  generic_name TEXT,
  strength TEXT NOT NULL, -- e.g., "500mg", "10mg"
  form TEXT NOT NULL, -- tablet, capsule, syrup, injection, etc.
  route TEXT, -- oral, topical, IV, etc.
  
  -- Inventory tracking
  current_stock INTEGER DEFAULT 0,
  minimum_stock INTEGER DEFAULT 10, -- Alert threshold
  maximum_stock INTEGER DEFAULT 1000,
  unit_of_measure TEXT DEFAULT 'units', -- units, bottles, vials, etc.
  
  -- Pricing (optional)
  cost_per_unit DECIMAL(10,2),
  selling_price_per_unit DECIMAL(10,2),
  
  -- Supplier information
  supplier_name TEXT,
  supplier_contact TEXT,
  last_order_date DATE,
  last_received_date DATE,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  expiry_tracking BOOLEAN DEFAULT false, -- Whether to track expiry dates
  
  -- Metadata
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one inventory entry per medication+strength+form per organization
  UNIQUE(organization_id, medication_name, strength, form)
);

-- 3. INVENTORY TRANSACTIONS (Stock movements)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES medication_inventory(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'dispense', 'adjustment', 'expiry', 'return', 'transfer')),
  quantity INTEGER NOT NULL, -- Positive for additions, negative for deductions
  balance_after INTEGER NOT NULL, -- Stock level after this transaction
  
  -- Reference information
  prescription_id UUID REFERENCES prescriptions(id), -- If dispensed for a prescription
  reference_number TEXT, -- Purchase order, invoice, etc.
  
  -- Notes
  notes TEXT,
  reason TEXT, -- For adjustments
  
  -- User tracking
  performed_by_user_id UUID REFERENCES users(id),
  performed_by_username TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DISPENSING RECORDS (Detailed dispensing history)
CREATE TABLE IF NOT EXISTS dispensing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES medication_inventory(id),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Patient and prescription info
  patient_id TEXT NOT NULL,
  medication_name TEXT NOT NULL,
  strength TEXT NOT NULL,
  form TEXT NOT NULL,
  
  -- Dispensing details
  quantity_dispensed INTEGER NOT NULL,
  batch_number TEXT,
  expiry_date DATE,
  
  -- Pricing
  unit_price DECIMAL(10,2),
  total_price DECIMAL(10,2),
  
  -- Pharmacist info
  dispensed_by_user_id UUID REFERENCES users(id),
  dispensed_by_username TEXT,
  
  -- Status
  status TEXT DEFAULT 'dispensed' CHECK (status IN ('dispensed', 'returned', 'cancelled')),
  
  -- Notes
  dispensing_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. STOCK ALERTS (Low stock and refill notifications)
CREATE TABLE IF NOT EXISTS stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES medication_inventory(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock', 'expiring_soon', 'expired', 'refill_needed')),
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  
  current_stock INTEGER,
  threshold_value INTEGER,
  
  message TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_prescriptions_pharmacy_status ON prescriptions(pharmacy_status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_sent_to_pharmacy ON prescriptions(sent_to_pharmacy_at);
CREATE INDEX IF NOT EXISTS idx_inventory_org ON medication_inventory(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_active ON medication_inventory(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON medication_inventory(organization_id, current_stock) WHERE current_stock <= minimum_stock;
CREATE INDEX IF NOT EXISTS idx_transactions_inventory ON inventory_transactions(inventory_id);
CREATE INDEX IF NOT EXISTS idx_transactions_org ON inventory_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON inventory_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispensing_prescription ON dispensing_records(prescription_id);
CREATE INDEX IF NOT EXISTS idx_dispensing_org ON dispensing_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_dispensing_date ON dispensing_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_org ON stock_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON stock_alerts(is_resolved) WHERE is_resolved = false;

-- Enable Row Level Security
ALTER TABLE medication_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispensing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their organization's data
CREATE POLICY "Users can view their org inventory" ON medication_inventory
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Pharmacists can manage inventory" ON medication_inventory
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE auth_user_id = auth.uid() 
      AND role IN ('Pharmacist', 'pharmacist', 'Admin', 'admin')
    )
  );

CREATE POLICY "Users can view their org transactions" ON inventory_transactions
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Pharmacists can create transactions" ON inventory_transactions
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE auth_user_id = auth.uid() 
      AND role IN ('Pharmacist', 'pharmacist', 'Admin', 'admin')
    )
  );

CREATE POLICY "Users can view their org dispensing records" ON dispensing_records
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Pharmacists can create dispensing records" ON dispensing_records
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE auth_user_id = auth.uid() 
      AND role IN ('Pharmacist', 'pharmacist', 'Admin', 'admin')
    )
  );

CREATE POLICY "Users can view their org alerts" ON stock_alerts
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Pharmacists can manage alerts" ON stock_alerts
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE auth_user_id = auth.uid() 
      AND role IN ('Pharmacist', 'pharmacist', 'Admin', 'admin')
    )
  );

-- Function to automatically create stock alerts
CREATE OR REPLACE FUNCTION check_stock_levels()
RETURNS void AS $$
BEGIN
  -- Create low stock alerts
  INSERT INTO stock_alerts (inventory_id, organization_id, alert_type, severity, current_stock, threshold_value, message)
  SELECT 
    id,
    organization_id,
    CASE 
      WHEN current_stock = 0 THEN 'out_of_stock'
      WHEN current_stock <= minimum_stock THEN 'low_stock'
    END,
    CASE 
      WHEN current_stock = 0 THEN 'critical'
      WHEN current_stock <= minimum_stock THEN 'warning'
    END,
    current_stock,
    minimum_stock,
    CASE 
      WHEN current_stock = 0 THEN medication_name || ' (' || strength || ' ' || form || ') is OUT OF STOCK'
      ELSE medication_name || ' (' || strength || ' ' || form || ') is running low. Current: ' || current_stock || ', Minimum: ' || minimum_stock
    END
  FROM medication_inventory
  WHERE is_active = true
    AND current_stock <= minimum_stock
    AND NOT EXISTS (
      SELECT 1 FROM stock_alerts 
      WHERE stock_alerts.inventory_id = medication_inventory.id 
        AND stock_alerts.alert_type IN ('low_stock', 'out_of_stock')
        AND stock_alerts.is_resolved = false
    );
END;
$$ LANGUAGE plpgsql;

-- Function to update inventory after dispensing
CREATE OR REPLACE FUNCTION update_inventory_on_dispense()
RETURNS TRIGGER AS $$
DECLARE
  v_current_stock INTEGER;
BEGIN
  -- Get current stock
  SELECT current_stock INTO v_current_stock
  FROM medication_inventory
  WHERE id = NEW.inventory_id;
  
  -- Update stock
  UPDATE medication_inventory
  SET current_stock = current_stock - NEW.quantity_dispensed,
      updated_at = NOW()
  WHERE id = NEW.inventory_id;
  
  -- Create transaction record
  INSERT INTO inventory_transactions (
    inventory_id,
    organization_id,
    transaction_type,
    quantity,
    balance_after,
    prescription_id,
    performed_by_user_id,
    performed_by_username,
    notes
  ) VALUES (
    NEW.inventory_id,
    NEW.organization_id,
    'dispense',
    -NEW.quantity_dispensed,
    v_current_stock - NEW.quantity_dispensed,
    NEW.prescription_id,
    NEW.dispensed_by_user_id,
    NEW.dispensed_by_username,
    'Dispensed for prescription ' || NEW.prescription_id::text
  );
  
  -- Check stock levels and create alerts if needed
  PERFORM check_stock_levels();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update inventory when medication is dispensed
CREATE TRIGGER trigger_update_inventory_on_dispense
  AFTER INSERT ON dispensing_records
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_on_dispense();

-- Add table comments
COMMENT ON TABLE medication_inventory IS 'Tracks medication inventory for pharmacy management';
COMMENT ON TABLE inventory_transactions IS 'Records all stock movements (purchases, dispensing, adjustments)';
COMMENT ON TABLE dispensing_records IS 'Detailed records of medication dispensing to patients';
COMMENT ON TABLE stock_alerts IS 'Alerts for low stock, out of stock, and refill needs';







