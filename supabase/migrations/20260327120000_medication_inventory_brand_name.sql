-- Trade/brand name separate from generic medication_name (bulk import & UI)
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS brand_name TEXT;
COMMENT ON COLUMN medication_inventory.brand_name IS 'Trade/brand name (e.g. Eden, Zisty); generic stays in medication_name for prescription matching';
