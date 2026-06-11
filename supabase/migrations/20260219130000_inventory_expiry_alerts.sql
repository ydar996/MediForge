-- Expiry alerts for pharmacy inventory (FEFO support, waste reduction)
-- Creates expiring_soon (<30 days) and expired alerts

CREATE OR REPLACE FUNCTION check_expiry_alerts()
RETURNS void AS $$
BEGIN
  -- Expired items
  INSERT INTO stock_alerts (inventory_id, organization_id, alert_type, severity, current_stock, threshold_value, message)
  SELECT id, organization_id, 'expired', 'critical', current_stock, NULL,
    medication_name || ' (' || strength || ' ' || form || ') EXPIRED on ' || expiry_date::text
  FROM medication_inventory
  WHERE is_active = true
    AND expiry_date IS NOT NULL
    AND expiry_date < CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1 FROM stock_alerts
      WHERE stock_alerts.inventory_id = medication_inventory.id
        AND stock_alerts.alert_type = 'expired'
        AND stock_alerts.is_resolved = false
    );

  -- Expiring soon (< 30 days)
  INSERT INTO stock_alerts (inventory_id, organization_id, alert_type, severity, current_stock, threshold_value, message)
  SELECT id, organization_id, 'expiring_soon', 'warning', current_stock, NULL,
    medication_name || ' (' || strength || ' ' || form || ') expires in ' || (expiry_date - CURRENT_DATE) || ' days'
  FROM medication_inventory
  WHERE is_active = true
    AND expiry_date IS NOT NULL
    AND expiry_date >= CURRENT_DATE
    AND expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    AND NOT EXISTS (
      SELECT 1 FROM stock_alerts
      WHERE stock_alerts.inventory_id = medication_inventory.id
        AND stock_alerts.alert_type = 'expiring_soon'
        AND stock_alerts.is_resolved = false
    );
END;
$$ LANGUAGE plpgsql;

-- Call from check_stock_levels so both run together
CREATE OR REPLACE FUNCTION check_stock_levels()
RETURNS void AS $$
BEGIN
  -- Low/out of stock alerts
  INSERT INTO stock_alerts (inventory_id, organization_id, alert_type, severity, current_stock, threshold_value, message)
  SELECT id, organization_id,
    CASE WHEN current_stock = 0 THEN 'out_of_stock' WHEN current_stock <= minimum_stock THEN 'low_stock' END,
    CASE WHEN current_stock = 0 THEN 'critical' WHEN current_stock <= minimum_stock THEN 'warning' END,
    current_stock, minimum_stock,
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

  -- Expiry alerts
  PERFORM check_expiry_alerts();
END;
$$ LANGUAGE plpgsql;
