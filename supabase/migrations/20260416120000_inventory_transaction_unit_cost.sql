-- Purchase lines: store receipt unit cost and extended cost for audit and COGS context.
-- Weighted average cost (WAC) remains on medication_inventory.cost_per_unit; transactions record each receipt.

ALTER TABLE public.inventory_transactions
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS extended_cost NUMERIC(14, 2);

COMMENT ON COLUMN public.inventory_transactions.unit_cost IS 'Unit acquisition cost for this movement (typically purchase receipts)';
COMMENT ON COLUMN public.inventory_transactions.extended_cost IS 'quantity * unit_cost for purchases when unit_cost is set';
