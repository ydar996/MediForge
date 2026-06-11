# Pharmacy Inventory Enhancements – Changelog

Industry-standard improvements aligned with Leafio AI, Datarithm, PrimeRx, KeHE best practices.

## Summary

- **Dashboard**: Real-time KPIs, charts (sales trend, category distribution, top-selling), color-coded alerts
- **Table View**: Industry-standard columns, search, filter, pagination, CSV/PDF export
- **Analytics**: ABC analysis, slow-moving/dead stock, expiry risk (FEFO priority)
- **Schema**: NDC, on_purchase_order, on_sales_order, warehouse_location
- **Alerts**: Expiring-soon (<30 days), expired items in addition to low/out-of-stock

---

## New Files

| File | Purpose |
|------|---------|
| `js/pharmacy-inventory-analytics.js` | KPIs, sales velocity, WOS, turnover, ABC analysis, slow-moving, expiry risk |
| `supabase/migrations/20260219120000_inventory_industry_standard_fields.sql` | NDC, on_purchase_order, on_sales_order, warehouse_location |
| `supabase/migrations/20260219130000_inventory_expiry_alerts.sql` | Expiring-soon and expired stock alerts |

---

## Modified Files

| File | Changes |
|------|---------|
| `pharmacy-dashboard.html` | Chart.js, pharmacy-inventory-analytics.js scripts |
| `js/pharmacy-dashboard.js` | Enhanced inventory: Dashboard + Table + Analytics tabs; industry-standard columns; search/filter/export |
| `js/pharmacy-manager.js` | `window.getPharmacyOrgId` exposed; `updateInventoryDetails` supports ndc, warehouse_location |

---

## Inventory Table Columns (Industry Standard)

| Column | Source |
|--------|--------|
| Item/Medicine Name | medication_name + strength + form |
| SKU/NDC | ndc or sku |
| Batch/Lot Number | batch_number |
| Expiry Date | expiry_date |
| Quantity on Hand | current_stock |
| On Purchase Order | on_purchase_order |
| On Sales Order | on_sales_order |
| Reorder Level | reorder_point or minimum_stock |
| Supplier/Manufacturer | manufacturer |
| Cost Price | cost_per_unit |
| Selling Price | selling_price_per_unit |
| Location/DC | warehouse_location or shelf_location |
| Pack Size | pack_size |
| Category/Type | therapeutic_category or Controlled |
| Sales Velocity | Computed from dispensing_records |
| Weeks of Supply | Qty / (Velocity × 7) |
| Status | In Stock, Low Stock, Out of Stock, Overstock |
| Last Received Date | last_received_date |
| Last Sold Date | last_dispensed_at |
| Inventory Turnover Rate | Annual sales / stock |
| Carrying Cost | cost × stock × holding % |

---

## Deployment

1. Run migrations in order: `20260219120000`, `20260219130000`
2. Deploy updated JS and HTML
3. Optionally call `check_stock_levels()` (or `check_expiry_alerts()`) via cron or on inventory load to populate alerts

---

## Future Enhancements (Not Implemented)

- Barcode scanning (camera/scanner API)
- FDA NDC lookup integration
- Purchase order module (on_purchase_order linkage)
- Multi-batch FEFO (requires schema change for multiple batches per medication)
- AI demand forecasting (linear regression / scikit-learn)
