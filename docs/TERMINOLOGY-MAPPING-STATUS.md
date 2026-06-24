# Terminology mapping status (LOINC, pCLOCD, CCDD)

**Updated:** June 2026  
**Purpose:** Document what MediForge maps in software vs what requires licensed full datasets.

## In software today

| Code set | Status | Location |
|----------|--------|----------|
| LOINC / pCLOCD (lab) | Partial mapping layer | `lib/interop/terminology/loinc-pclocd.js` (~22 common tests + extensible config) |
| SNOMED CT (imaging modality) | Partial | `lib/interop/terminology/snomed.js` |
| CCDD / DIN (Rx) | Partial overlay | `lib/interop/terminology/ccdd.js` + Health Canada DPD formulary in product |
| OHIP fee codes (lab/imaging) | Done | Provincial crosswalks in `config/` |

## Not loaded (license / purchase required)

| Code set | Gap | Owner action |
|----------|-----|--------------|
| Full pCLOCD release | Unmapped tests fall back to display name only | License from Infoway / LOINC org when ready |
| Full CCDD | Optional PrescribeIT enhancement | License when enrolling for eRx |
| Full SNOMED CT | Imaging uses modality subset | Enterprise terminology license if required by OntarioMD |

## Agent note

Do not claim "full LOINC/CCDD loaded" in readiness pages until licensed files are imported. Mapping **helpers** are complete; **dataset load** is owner/licensor gated.
