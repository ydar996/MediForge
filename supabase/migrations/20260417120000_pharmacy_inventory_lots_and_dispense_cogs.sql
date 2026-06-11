-- Lot-level inventory layers, FEFO/FIFO dispensing via app + RPC, COGS on dispensing.
-- Drops legacy trigger that decremented stock on dispensing_records INSERT (replaced by apply_pharmacy_dispense + client).

-- 1) Layers (receipts / opening balances)
CREATE TABLE IF NOT EXISTS public.inventory_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES public.medication_inventory(id) ON DELETE CASCADE,
  quantity_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  unit_cost NUMERIC(12, 4),
  batch_number TEXT,
  expiry_date DATE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_lots_org ON public.inventory_lots(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_inventory ON public.inventory_lots(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_expiry ON public.inventory_lots(inventory_id, expiry_date NULLS LAST, received_at);

COMMENT ON TABLE public.inventory_lots IS 'Quantity and unit cost by receipt/layer; aggregate current_stock on medication_inventory should match sum(quantity_on_hand).';

-- 2) Per-dispense allocation to lots (COGS audit)
CREATE TABLE IF NOT EXISTS public.dispensing_lot_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  dispensing_record_id UUID NOT NULL REFERENCES public.dispensing_records(id) ON DELETE CASCADE,
  inventory_lot_id UUID NOT NULL REFERENCES public.inventory_lots(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12, 4),
  extended_cost NUMERIC(14, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispensing_lot_alloc_disp ON public.dispensing_lot_allocations(dispensing_record_id);
CREATE INDEX IF NOT EXISTS idx_dispensing_lot_alloc_lot ON public.dispensing_lot_allocations(inventory_lot_id);

-- 3) COGS columns on dispensing row
ALTER TABLE public.dispensing_records
  ADD COLUMN IF NOT EXISTS cogs_total NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS cogs_unit NUMERIC(12, 4);

COMMENT ON COLUMN public.dispensing_records.cogs_total IS 'Total acquisition cost (COGS) for quantity_dispensed from allocated lots.';
COMMENT ON COLUMN public.dispensing_records.cogs_unit IS 'Average unit COGS for this dispense (cogs_total / quantity_dispensed).';

-- 4) RLS
ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispensing_lot_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org inventory lots"
  ON public.inventory_lots FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Pharmacists manage org inventory lots"
  ON public.inventory_lots FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users
      WHERE auth_user_id = auth.uid()
        AND lower(trim(role)) IN ('pharmacist', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users
      WHERE auth_user_id = auth.uid()
        AND lower(trim(role)) IN ('pharmacist', 'admin')
    )
  );

CREATE POLICY "Users can view org dispensing lot allocations"
  ON public.dispensing_lot_allocations FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Pharmacists insert dispensing lot allocations"
  ON public.dispensing_lot_allocations FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users
      WHERE auth_user_id = auth.uid()
        AND lower(trim(role)) IN ('pharmacist', 'admin')
    )
  );

-- 5) Remove automatic stock/transaction on dispensing insert (app + RPC own the flow)
DROP TRIGGER IF EXISTS trigger_update_inventory_on_dispense ON public.dispensing_records;

-- 6) Stock/expiry alerts when current_stock changes (was previously invoked from dispense trigger)
CREATE OR REPLACE FUNCTION public.trg_medication_inventory_stock_alerts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.current_stock IS DISTINCT FROM OLD.current_stock THEN
    PERFORM public.check_stock_levels();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_medication_inventory_stock_alerts ON public.medication_inventory;
CREATE TRIGGER trigger_medication_inventory_stock_alerts
  AFTER UPDATE OF current_stock ON public.medication_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_medication_inventory_stock_alerts();

-- 7) Opening layers: one row per inventory line with on-hand stock and no layers yet
INSERT INTO public.inventory_lots (
  organization_id,
  inventory_id,
  quantity_on_hand,
  unit_cost,
  batch_number,
  expiry_date,
  received_at,
  source,
  notes
)
SELECT
  mi.organization_id,
  mi.id,
  mi.current_stock,
  mi.cost_per_unit,
  mi.batch_number,
  mi.expiry_date,
  COALESCE(mi.created_at, NOW()),
  'opening_backfill',
  'Migrated from aggregate on-hand; single layer before lot tracking.'
FROM public.medication_inventory mi
WHERE mi.current_stock > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.inventory_lots il WHERE il.inventory_id = mi.id
  );

-- 8) Atomic dispense: dispensing row, lot allocations, inventory, movement, alerts (via trigger)
CREATE OR REPLACE FUNCTION public.apply_pharmacy_dispense(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d jsonb := p_payload->'dispensing';
  allocs jsonb := p_payload->'allocations';
  v_org uuid;
  v_inv uuid;
  v_qty int;
  v_balance_before int;
  v_balance_after int;
  v_inv_uc numeric;
  v_disp_id uuid;
  v_i int;
  v_piece jsonb;
  v_lot_id uuid;
  v_lq int;
  v_qoh int;
  v_uc numeric;
  v_line_cost numeric;
  v_cogs numeric := 0;
  v_sum_alloc int := 0;
  v_notes text;
BEGIN
  IF d IS NULL OR allocs IS NULL THEN
    RAISE EXCEPTION 'invalid payload';
  END IF;

  v_org := (d->>'organization_id')::uuid;
  v_inv := (d->>'inventory_id')::uuid;
  v_qty := (d->>'quantity_dispensed')::int;

  IF v_org IS NULL OR v_inv IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
    RAISE EXCEPTION 'invalid dispensing fields';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND u.organization_id = v_org
      AND lower(trim(u.role)) IN ('pharmacist', 'admin')
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT COALESCE(SUM((t.elem->>'quantity')::int), 0)
  INTO v_sum_alloc
  FROM jsonb_array_elements(allocs) AS t(elem);

  IF v_sum_alloc != v_qty THEN
    RAISE EXCEPTION 'allocation sum % does not match quantity_dispensed %', v_sum_alloc, v_qty;
  END IF;

  SELECT current_stock, cost_per_unit
  INTO v_balance_before, v_inv_uc
  FROM public.medication_inventory
  WHERE id = v_inv AND organization_id = v_org
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory not found';
  END IF;

  IF v_balance_before < v_qty THEN
    RAISE EXCEPTION 'insufficient stock';
  END IF;

  v_notes := 'Dispensed for prescription ' || COALESCE(d->>'prescription_id', '');

  INSERT INTO public.dispensing_records (
    prescription_id,
    inventory_id,
    organization_id,
    patient_id,
    medication_name,
    strength,
    form,
    quantity_dispensed,
    batch_number,
    expiry_date,
    unit_price,
    total_price,
    dispensed_by_user_id,
    dispensed_by_username,
    dispensing_notes,
    status
  ) VALUES (
    (d->>'prescription_id')::uuid,
    v_inv,
    v_org,
    d->>'patient_id',
    d->>'medication_name',
    d->>'strength',
    d->>'form',
    v_qty,
    NULLIF(d->>'batch_number', ''),
    CASE WHEN d ? 'expiry_date' AND NULLIF(d->>'expiry_date', '') IS NOT NULL THEN (d->>'expiry_date')::date ELSE NULL END,
    NULLIF(d->>'unit_price', '')::numeric,
    NULLIF(d->>'total_price', '')::numeric,
    NULLIF(d->>'dispensed_by_user_id', '')::uuid,
    NULLIF(d->>'dispensed_by_username', ''),
    NULLIF(d->>'dispensing_notes', ''),
    COALESCE(NULLIF(d->>'status', ''), 'dispensed')
  )
  RETURNING id INTO v_disp_id;

  FOR v_i IN 0 .. COALESCE(jsonb_array_length(allocs),0) - 1 LOOP
    v_piece := allocs->v_i;
    v_lot_id := (v_piece->>'lot_id')::uuid;
    v_lq := (v_piece->>'quantity')::int;
    IF v_lot_id IS NULL OR v_lq IS NULL OR v_lq <= 0 THEN
      RAISE EXCEPTION 'invalid allocation row';
    END IF;

    SELECT quantity_on_hand, unit_cost
    INTO v_qoh, v_uc
    FROM public.inventory_lots
    WHERE id = v_lot_id AND organization_id = v_org AND inventory_id = v_inv
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'lot not found';
    END IF;

    IF v_qoh < v_lq THEN
      RAISE EXCEPTION 'insufficient quantity in lot';
    END IF;

    v_uc := COALESCE(v_uc, v_inv_uc);
    IF v_uc IS NOT NULL THEN
      v_line_cost := round(v_lq::numeric * v_uc, 2);
      v_cogs := v_cogs + v_line_cost;
    ELSE
      v_line_cost := NULL;
    END IF;

    UPDATE public.inventory_lots
    SET quantity_on_hand = quantity_on_hand - v_lq,
        updated_at = NOW()
    WHERE id = v_lot_id;

    INSERT INTO public.dispensing_lot_allocations (
      organization_id,
      dispensing_record_id,
      inventory_lot_id,
      quantity,
      unit_cost,
      extended_cost
    ) VALUES (
      v_org,
      v_disp_id,
      v_lot_id,
      v_lq,
      v_uc,
      v_line_cost
    );
  END LOOP;

  v_balance_after := v_balance_before - v_qty;

  UPDATE public.medication_inventory
  SET current_stock = v_balance_after,
      last_dispensed_at = NOW(),
      updated_at = NOW()
  WHERE id = v_inv;

  UPDATE public.dispensing_records
  SET cogs_total = CASE WHEN v_cogs > 0 THEN round(v_cogs, 2) ELSE NULL END,
      cogs_unit = CASE WHEN v_cogs > 0 AND v_qty > 0 THEN round(v_cogs / v_qty::numeric, 4) ELSE NULL END
  WHERE id = v_disp_id;

  INSERT INTO public.inventory_transactions (
    inventory_id,
    organization_id,
    transaction_type,
    quantity,
    balance_after,
    prescription_id,
    performed_by_user_id,
    performed_by_username,
    notes,
    unit_cost,
    extended_cost
  ) VALUES (
    v_inv,
    v_org,
    'dispense',
    -v_qty,
    v_balance_after,
    (d->>'prescription_id')::uuid,
    NULLIF(d->>'dispensed_by_user_id', '')::uuid,
    NULLIF(d->>'dispensed_by_username', ''),
    v_notes,
    CASE WHEN v_cogs > 0 AND v_qty > 0 THEN round(v_cogs / v_qty::numeric, 4) ELSE NULL END,
    CASE WHEN v_cogs > 0 THEN round(v_cogs, 2) ELSE NULL END
  );

  RETURN jsonb_build_object(
    'dispensing_record_id', v_disp_id,
    'balance_after', v_balance_after,
    'cogs_total', CASE WHEN v_cogs > 0 THEN round(v_cogs, 2) ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_pharmacy_dispense(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_pharmacy_dispense(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_pharmacy_dispense(jsonb) TO service_role;
