# CCDD overlay (optional)

Health Canada **DPD** (Drug Product Database) is imported automatically by `npm run build:formulary`.

**CCDD** (Canadian Clinical Drug Data Set) codes are licensed from Canada Health Infoway. MediForge does not ship the full CCDD file.

To attach CCDD codes to DINs you already use, add entries to `din-ccdd.json`:

```json
{
  "02229726": { "ccdd": "9000378", "display": "Metformin 500mg tablet" }
}
```

Then run:

```powershell
npm run build:formulary
```

Rebuild merges `ccdd` into `js/canadian-formulary.js` for e-prescribing payloads.
