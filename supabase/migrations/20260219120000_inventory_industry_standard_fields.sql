-- Industry-standard inventory fields for pharmacy management (Leafio, Datarithm, PrimeRx, etc.)
-- Adds NDC, on-order quantities, location, and supports multi-site

-- NDC (National Drug Code) - for FDA/NAFDAC lookups
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS ndc TEXT;
COMMENT ON COLUMN medication_inventory.ndc IS 'National Drug Code for FDA/regulatory lookups';

-- On-order quantities (link to future PO/SO modules)
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS on_purchase_order INTEGER DEFAULT 0;
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS on_sales_order INTEGER DEFAULT 0;
COMMENT ON COLUMN medication_inventory.on_purchase_order IS 'Quantity pending on purchase orders';
COMMENT ON COLUMN medication_inventory.on_sales_order IS 'Quantity reserved for prescriptions/sales orders';

-- Warehouse/location for multi-site (shelf_location = bin, warehouse_location = site)
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS warehouse_location TEXT;
COMMENT ON COLUMN medication_inventory.warehouse_location IS 'Site/warehouse for multi-location support';

-- Index for NDC lookups and expiry-based FEFO
CREATE INDEX IF NOT EXISTS idx_inventory_ndc ON medication_inventory(ndc) WHERE ndc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON medication_inventory(organization_id, expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON medication_inventory(organization_id, warehouse_location) WHERE warehouse_location IS NOT NULL;
