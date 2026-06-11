# Pharmacy Inventory Enhancements

Industry-standard improvements aligned with Leafio AI, Datarithm, PrimeRx, KeHE, and similar systems.

## Summary of Changes

### 1. Database Migrations

- **20260219120000_inventory_industry_standard_fields.sql**
  - `ndc` – National Drug Code for FDA/regulatory lookups
  - `on_purchase_order` – Quantity pending on POs
  - `on_sales_order` – Quantity reserved for prescriptions
  - `warehouse_location` – Multi-site support
  - Indexes on `ndc`, `expiry_date`, `warehouse_location`

- **20260219130000_inventory_expiry_alerts.sql**
  - `expired` alerts for items past expiry
  - `expiring_soon` alerts for items expiring within 30 days

### 2. Inventory Dashboard

- **KPIs:** Total items, inventory value, low/out-of-stock counts, near-expiry/expired, average turnover
- **Charts:** Sales trend (30 days), inventory by category (doughnut), top-selling items (bar)
- **Alerts:** Color-coded banner for critical (expired) and warning (near-expiry, low stock)

### 3. Enhanced Inventory Table

- **Columns (industry-standard names):**
  - Item/Medicine Name, SKU/NDC, Batch/Lot, Expiry, Quantity on Hand
  - On Purchase Order, On Sales Order, Reorder Level
  - Supplier/Manufacturer, Cost Price, Selling Price
  - Location, Pack Size, Category/Type
  - Sales Velocity, Weeks of Supply (WOS), Status
  - Last Received, Last Sold, Turnover Rate, Carrying Cost
- **Search:** By name, SKU, batch, manufacturer
- **Filters:** Status, category
- **Pagination:** 20 items per page
- **Export:** CSV, PDF (print)

### 4. Analytics Module (`js/pharmacy-inventory-analytics.js`)

- **ABC analysis** – Classify items by value (A=high, B=medium, C=low)
- **Slow-moving / dead stock** – Items unsold >60 or >90 days
- **Expiry risk (FEFO)** – Sorted by expiry for First Expired First Out
- **Sales velocity** – Units per day from dispensing records
- **Weeks of supply** – Qty on hand / (velocity × 7)
- **Turnover rate** – Annual sales / average stock
- **Carrying cost** – Simplified holding cost

### 5. FEFO and Expiry

- Expiry risk report sorted by days to expiry
- Stock alerts for expired and expiring-soon items
- FEFO ordering in analytics views

### 6. Compliance and Security

- Existing audit trails for inventory changes
- Controlled substance tracking via `controlled_substance` field
- Edit modal includes NDC, batch, expiry, and controlled substance

### 7. Multi-Location

- `warehouse_location` for site/warehouse
- Filtering by location supported in schema

## Files Modified/Created

| File | Change |
|------|--------|
| `supabase/migrations/20260219120000_inventory_industry_standard_fields.sql` | New |
| `supabase/migrations/20260219130000_inventory_expiry_alerts.sql` | New |
| `js/pharmacy-inventory-analytics.js` | New |
| `js/pharmacy-dashboard.js` | Enhanced loadInventory, dashboard, table, analytics |
| `js/pharmacy-manager.js` | Added ndc, warehouse_location, on_purchase_order, on_sales_order to allowed fields; expose getPharmacyOrgId |
| `pharmacy-dashboard.html` | Added Chart.js, pharmacy-inventory-analytics.js |

## Deployment

1. Run migrations in order:
   - `20260219120000_inventory_industry_standard_fields.sql`
   - `20260219130000_inventory_expiry_alerts.sql`
2. Deploy updated JS and HTML.

## Future Enhancements (Not Implemented)

- Barcode scanning (camera/scanner API)
- NDC lookup via FDA API
- Purchase order module
- AI-driven demand forecasting (e.g. linear regression)
- Column hide/show and reorder
- Real-time updates via WebSockets
