-- inventory_price_history had no RLS; enable org-scoped read + pharmacist insert (matches app behavior).
-- Safe additive: only affects this table; does not alter medication_inventory or transactions.

ALTER TABLE public.inventory_price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_price_history_select_org" ON public.inventory_price_history;
CREATE POLICY "inventory_price_history_select_org"
  ON public.inventory_price_history FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      WHERE u.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "inventory_price_history_insert_pharmacist" ON public.inventory_price_history;
CREATE POLICY "inventory_price_history_insert_pharmacist"
  ON public.inventory_price_history FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT u.organization_id FROM public.users u
      WHERE u.auth_user_id = auth.uid()
        AND (
          u.role IN ('Pharmacist', 'pharmacist', 'Admin', 'admin', 'Doctor', 'doctor', 'Physician', 'physician')
          OR lower(trim(both from coalesce(u.role, ''))) IN (
            'pharmacist', 'admin', 'doctor', 'physician', 'pharmacy manager', 'pharmacy_manager'
          )
        )
    )
  );
