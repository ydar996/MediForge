# Health Canada DPD (Drug Product Database)

## Automatic build (recommended)

```powershell
npm run build:formulary
```

This downloads open DPD JSON from Health Canada and writes `js/canadian-formulary.js`.

## Offline / extract files (optional)

1. Download **all files** from [Health Canada DPD extract](https://www.canada.ca/en/health-canada/services/drug-product-database/elements-description-database.html).
2. Unzip into `data/dpd-cache/` so `drug.txt` exists.
3. Run `npm run build:formulary` again (uses local files instead of the API).

## CCDD

See `data/ccdd/README.md` for optional clinical drug codes on top of DIN.
