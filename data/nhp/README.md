# Health Canada LNHPD (Licensed Natural Health Products Database)

## Build

```powershell
npm run build:nhp-formulary
```

Downloads the full ProductLicence bulk JSON from Health Canada and writes `js/canadian-nhp-formulary.js` (~129k active primary NHP products).

## Cache

The first run caches raw API data to `data/nhp-cache/product-licences.json` (~60s download). Rebuilds use the cache unless deleted.

## Search

Merged with DPD in `js/canadian-formulary-search.js`: `searchCanadianDrugs()` returns both prescription drugs (DIN) and natural health products (NPN).
