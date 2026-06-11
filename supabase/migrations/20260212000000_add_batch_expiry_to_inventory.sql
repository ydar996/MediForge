-- Add batch_number and expiry_date to medication_inventory for dispensing traceability
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE medication_inventory ADD COLUMN IF NOT EXISTS expiry_date DATE;
COMMENT ON COLUMN medication_inventory.batch_number IS 'Batch/lot number for this inventory item';
COMMENT ON COLUMN medication_inventory.expiry_date IS 'Expiry date for this inventory item';
