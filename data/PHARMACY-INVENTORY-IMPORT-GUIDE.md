# Pharmacy Inventory Import Guide

Use this guide to prepare medication and consumable data for import into the EHR pharmacy inventory. **Names must match the prescription system** so doctors' prescriptions can be dispensed from stock.

---

## Preferred Format (CSV Template)

**Use this format for best results.** Download the template: `pharmacy-inventory-import-template.csv`

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| **medication_name** | Yes | Generic or brand name:**must match what doctors prescribe** (e.g. Amlodipine, Paracetamol) | Amlodipine |
| **strength** | Yes | Dosage strength | 10mg, 500mg, 5/50mg |
| **form** | Yes | Dosage form | Tablet, Capsule, Injection, Syrup, Cream, Eye drops |
| **quantity** | Yes | Amount in stock | 16 |
| **unit_of_measure** | Yes | Unit used to count/stock the item | PACKS, TABS, BOTTLES, VIALS, AMPOULES, PCS |
| **expiry_date** | No | Expiration date | 2027-06-01 or Jun-27 |
| **unit_price** | No | Price per unit (in org currency) | 1500 |
| **unit_for_pricing** | No | Unit that the price applies to:use only when different from unit_of_measure | TAB, CARD, PACK |

### unit_of_measure vs unit_for_pricing

| Column | Meaning |
|--------|---------|
| **unit_of_measure** | How you count and track stock (e.g. 16 PACKS, 600 TABS) |
| **unit_for_pricing** | What unit the unit_price is per:leave blank when price is per the same unit as quantity |

**Examples:**
- Stock: 16 PACKS, price ₦1,500 per PACK → `unit_of_measure: PACKS`, `unit_price: 1500`, `unit_for_pricing:` (leave blank)
- Stock: 600 TABS, price ₦50 per TAB → `unit_of_measure: TABS`, `unit_price: 50`, `unit_for_pricing:` (leave blank)
- Stock: 16 PACKS (each pack has 10 tablets), price ₦50 per TAB → `unit_of_measure: PACKS`, `unit_price: 50`, `unit_for_pricing: TAB`

### Form values (use exactly)

| Form | Use for |
|------|---------|
| Tablet | Tablets |
| Capsule | Capsules |
| Injection | IV, IVF, INJ |
| Syrup | Syrups |
| Suspension | Suspensions |
| Cream | Creams |
| Ointment | Ointments |
| Gel | Gels |
| Lotion | Lotions |
| Eye drops | Gutt, eye drops |
| Nebule | Nebules |

### Example (preferred format)

```csv
medication_name,strength,form,quantity,unit_of_measure,expiry_date,unit_price,unit_for_pricing
Amlodipine,10mg,Tablet,16,PACKS,2027-06-01,1500,
Lisinopril,10mg,Tablet,7,PACKS,2028-06-01,1400,
Paracetamol,500mg,Tablet,1000,TABS,2028-07-01,15,TAB
Omeprazole,20mg,Capsule,12,PACKS,2028-05-01,1000,PACK
```

---

## Legacy Format (alternative)

If your data uses the older format below, the import will **normalize** it to match the EHR. Use the preferred format when possible.

| Column | Example |
|--------|---------|
| S/NO | 1 |
| ITEMS/MEDICATION | TABS AMLODPINE 10MG |
| QUANTITY | 16 PACKS |
| EXPIRARY DATE | Jun-27 |
| UNIT PRICE | 1500 or 50/TAB |

---

## Naming rules

1. **Medication names** must match the prescription dropdown (e.g. Amlodipine, not AMLODPINE or TABS AMLODPINE).
2. **Strength** format: `10mg`, `500mg`, `5/50mg`, `100mcg`.
3. **Form** must be one of the values in the table above.

---

## Excel users

1. Create columns: medication_name, strength, form, quantity, unit_of_measure, expiry_date, unit_price, unit_for_pricing
2. Fill in data using the rules above
3. Save as **CSV (Comma delimited) (.csv)**
4. Import via Pharmacy Dashboard → Import Opening Stock

---

## Template files

- **`data/pharmacy-bulk-upload-template.csv`**: Recommended template with descriptive column names, includes **Cost per Unit** and **Selling Price per Unit**. Use for full imports or bulk cost/price updates.
- **`data/pharmacy-inventory-import-template.csv`**: Original minimal template (still supported).

See **`data/PHARMACY-BULK-UPLOAD-GUIDE.md`** for bulk cost updates and column variations.
