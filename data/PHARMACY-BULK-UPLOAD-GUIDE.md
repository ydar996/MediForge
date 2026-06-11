# Pharmacy Bulk Upload Guide

Use this guide for bulk importing or updating pharmacy inventory, including **cost prices** and selling prices.

---

## Recommended Template

**Download:** `pharmacy-bulk-upload-template.csv`

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| **Medication Name** | Yes | Generic or brand name—must match prescriptions | Amlodipine |
| **Strength** | Yes | Dosage strength | 10mg, 500mg, 5/50mg |
| **Form** | Yes | Dosage form | Tablet, Capsule, Injection, Syrup, Cream, Eye drops |
| **Quantity on Hand** | Yes | Amount in stock | 16 |
| **Unit of Measure** | Yes | How you count stock | PACKS, TABS, BOTTLES, VIALS, AMPOULES, PCS |
| **Expiry Date** | No | YYYY-MM-DD | 2027-06-01 |
| **Cost per Unit** | No | Purchase/cost price (for margin tracking) | 3335 |
| **Selling Price per Unit** | No | Retail price | 1500 |
| **Unit for Pricing** | No | When price is per different unit (TAB, PACK, etc.) | PACK |
| **Batch Number** | No | Lot/batch for traceability | LOT2024001 |

### Column name variations (all accepted)

The import recognizes these alternative headers:

- `medication_name` or `Medication Name` or `medication` or `drug_name` or `item`
- `quantity` or `Quantity on Hand` or `qty` or `stock` or `current_stock`
- `unit_price` or `Selling Price per Unit` or `price` or `selling_price`
- `cost_per_unit` or `Cost per Unit` or `cost` or `cost_price`
- `unit_for_pricing` or `Unit for Pricing` or `price_unit` or `price_per`
- `batch_number` or `Batch Number` or `batch`

---

## Weighted average cost (WAC) and audit trail

- **`medication_inventory.cost_per_unit`** is the **weighted average unit cost** for the on-hand pool when you add stock **with a receipt unit cost** (bulk import with “update existing”, restock from **Add Medication**, or opening rows that include cost).
- Formula: \((\text{old qty} \times \text{old WAC} + \text{receipt qty} \times \text{receipt unit cost}) / (\text{old qty} + \text{receipt qty})\). If there was no prior average, the first receipt cost becomes the average.
- **Receipt lines** are stored on **`inventory_transactions`** (`transaction_type = 'purchase'`) with **`unit_cost`** and **`extended_cost`** when the DB migration for those columns has been applied.
- **Average cost changes** are appended to **`inventory_price_history`** and **`inventory_price_changed`** audit events (with a `source` such as `bulk_import`, `restock_wac`, or `initial_stock`).
- **Cost-only bulk rows** (quantity `0`, cost filled) **replace** the stored average for that item—they do not blend with zero new units.

Run migration: `supabase/migrations/20260416120000_inventory_transaction_unit_cost.sql` on your Supabase project so purchase rows can store unit cost.

**View in the app:** Pharmacy Dashboard → **Inventory** tab → **Table** view → **History** on a row (or **Edit** → **Cost & receipt history**). Read-only tables load `inventory_price_history` and `inventory_transactions` for that line. Apply `20260416130000_inventory_price_history_rls.sql` so pharmacists can read history under RLS.

## Use cases

### 1. Full inventory import (new items + prices)

Use the template with all columns. New items are inserted; existing items (matched by medication_name + strength + form) have stock added and prices updated.

### 2. Bulk cost update (inventory already in EMR)

Use this when you have already imported opening stock and want to bulk update cost prices:

1. **Prepare your CSV** – Use `pharmacy-bulk-upload-template.csv` or create one with:
   - **Medication Name**, **Strength**, **Form** – must match exactly what’s in the EMR (for matching)
   - **Cost per Unit** – new cost prices
   - **Quantity on Hand** – set to `0` so stock is not changed
   - **Selling Price per Unit** – leave empty if you don’t want to change it

2. **Import** – Go to **Pharmacy Dashboard** → **Import Opening Stock** tab.

3. **Enable update mode** – Check **“Update existing items (cost, selling price, stock)”**.

4. **Paste or upload** your CSV and click **Import**.

5. **Result** – Matched items (by medication_name + strength + form) will have their cost updated. Stock stays the same when quantity is 0. Selling price is unchanged if left empty.

### 3. Bulk selling price update

Use a CSV with **Medication Name**, **Strength**, **Form**, and **Selling Price per Unit**. Check **“Update existing items”** and import. Same matching rules apply.

---

## Items not in current inventory

The file `pharmacy-cost-items-not-in-inventory.csv` lists **177 items** from the cost example that are not in the existing opening-stock template. These are candidates to add to inventory if you want to track their cost prices.

- **Source:** Compared `pharmacy-cost-example.csv` vs `pharmacy-opening-stock-ehr-format.csv`
- **Criteria:** Items with cost prices in the cost example that have no matching medication_name + strength + form in opening stock
- **Use:** Review and add to your bulk upload template if needed; normalize names to match prescription format

---

## Import steps

1. Prepare your CSV using the template or compatible column names
2. Go to **Pharmacy Dashboard** → **Import Opening Stock** tab
3. If updating existing items (e.g. cost prices), check **“Update existing items (cost, selling price, stock)”**
4. Paste CSV or upload file
5. Click **Import**
6. Cost and selling price changes are logged (see inventory price history)

---

## Files reference

| File | Purpose |
|------|---------|
| `pharmacy-bulk-upload-template.csv` | Recommended template (Cost column may be empty – use `pharmacy-bulk-upload-template-updated.csv` for Cost & Selling) |
| `pharmacy-bulk-upload-template-updated.csv` | Template with Cost (70% of Selling) and Selling pre-filled |
| `pharmacy-inventory-import-template.csv` | Original minimal template (still supported) |
| `pharmacy-cost-items-not-in-inventory.csv` | Items from cost list not in opening stock |
| `pharmacy-opening-stock-ehr-format.csv` | Current inventory format (reference) |
| `pharmacy-cost-example.csv` | Example cost list (legacy format) |
