-- Inventory price history: audit trail for cost and selling price changes
-- Prices are effective from the timestamp of change; historical values preserved for compliance

CREATE TABLE IF NOT EXISTS inventory_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES medication_inventory(id) ON DELETE CASCADE,
  
  -- What changed
  field_changed TEXT NOT NULL CHECK (field_changed IN ('cost_per_unit', 'selling_price_per_unit', 'price_unit')),
  old_value DECIMAL(10,2),
  new_value DECIMAL(10,2),
  old_value_text TEXT,  -- For price_unit (TAB, PACK, etc.)
  new_value_text TEXT,
  
  -- Effective from: price change takes effect at this moment
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Audit
  changed_by TEXT NOT NULL,
  changed_by_user_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_price_history_inventory ON inventory_price_history(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_price_history_org ON inventory_price_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_price_history_effective ON inventory_price_history(effective_from DESC);

COMMENT ON TABLE inventory_price_history IS 'Audit trail for pharmacy inventory price changes; effective_from = when new price took effect';
