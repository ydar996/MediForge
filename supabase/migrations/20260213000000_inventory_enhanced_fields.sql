-- Enhanced medication_inventory fields for robust pharmacy management
-- All columns optional; useful for compliance, supply chain, and operations

-- Regulatory & compliance
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS registration_number TEXT;
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS country_of_origin TEXT;
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS prescription_only BOOLEAN DEFAULT false;
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS controlled_substance TEXT;
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS storage_conditions TEXT;

-- Identification
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS barcode TEXT;

-- Supply chain & ordering
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS reorder_point INTEGER;
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS reorder_quantity INTEGER;
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS pack_size INTEGER;
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS unit_of_purchase TEXT;
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS lead_time_days INTEGER;

-- Location
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS shelf_location TEXT;

-- Financial
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS tax_exempt BOOLEAN DEFAULT false;
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS last_purchase_cost DECIMAL(10,2);

-- Clinical
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS therapeutic_category TEXT;
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS atc_code TEXT;

-- Audit / traceability
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS last_dispensed_at TIMESTAMPTZ;
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS last_restocked_at TIMESTAMPTZ;

-- Storage & handling
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS cold_chain BOOLEAN DEFAULT false;
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS special_handling TEXT;

COMMENT ON COLUMN medication_inventory.registration_number IS 'NAFDAC/FDA or other regulatory registration number';
COMMENT ON COLUMN medication_inventory.manufacturer IS 'Drug manufacturer';
COMMENT ON COLUMN medication_inventory.country_of_origin IS 'Country of origin for traceability';
COMMENT ON COLUMN medication_inventory.prescription_only IS 'Rx-only vs OTC';
COMMENT ON COLUMN medication_inventory.controlled_substance IS 'Schedule/class if controlled';
COMMENT ON COLUMN medication_inventory.storage_conditions IS 'e.g. 2-8°C, room temp, protect from light';
COMMENT ON COLUMN medication_inventory.sku IS 'Internal product/SKU code';
COMMENT ON COLUMN medication_inventory.barcode IS 'Barcode for scanning';
COMMENT ON COLUMN medication_inventory.reorder_point IS 'Stock level that triggers reorder';
COMMENT ON COLUMN medication_inventory.reorder_quantity IS 'Suggested order quantity';
COMMENT ON COLUMN medication_inventory.pack_size IS 'Units per pack (e.g. 10 tablets per blister)';
COMMENT ON COLUMN medication_inventory.unit_of_purchase IS 'e.g. boxes, bottles, vials';
COMMENT ON COLUMN medication_inventory.lead_time_days IS 'Typical days to restock';
COMMENT ON COLUMN medication_inventory.shelf_location IS 'Shelf/bin location in pharmacy';
COMMENT ON COLUMN medication_inventory.tax_exempt IS 'Tax/VAT exempt';
COMMENT ON COLUMN medication_inventory.last_purchase_cost IS 'Most recent purchase cost';
COMMENT ON COLUMN medication_inventory.therapeutic_category IS 'e.g. antibiotic, antihypertensive';
COMMENT ON COLUMN medication_inventory.atc_code IS 'WHO ATC classification';
COMMENT ON COLUMN medication_inventory.last_dispensed_at IS 'Last dispensed timestamp';
COMMENT ON COLUMN medication_inventory.last_restocked_at IS 'Last restocked timestamp';
COMMENT ON COLUMN medication_inventory.cold_chain IS 'Requires refrigeration';
COMMENT ON COLUMN medication_inventory.special_handling IS 'e.g. hazardous, light-sensitive';
