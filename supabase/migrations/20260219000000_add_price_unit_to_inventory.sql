-- Add price_unit for when selling price is per different unit than quantity (e.g. /TAB when qty in PACKS)
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS price_unit TEXT;
COMMENT ON COLUMN medication_inventory.price_unit IS 'Unit for selling_price_per_unit when different from unit_of_measure (e.g. TAB, CARD, PACK)';
