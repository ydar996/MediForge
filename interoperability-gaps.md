# MediForge Interoperability Gap Analysis

**Date:** 2026-06-11  
**Scope:** Lab orders/results, imaging orders/results, prescriptions/e-prescribing  
**Target:** Canada (OLIS, provincial DIS, Infoway FHIR, post-PrescribeIT open standard) with North American compatibility

---

## Executive summary

MediForge today is a **Supabase-first in-clinic EMR** with strong internal lab/pharmacy workflows but **no production-grade external interoperability**. Orders and results live in the `orders` table (JSONB); prescriptions in `prescriptions`. CPT codes and ICD-11 are used internally—not LOINC, pCLOCD, SNOMED CT, or CCDD.

**This document records pre-upgrade gaps.** Core interoperability modules are being added under `lib/interop/`, `netlify/functions/interop-gateway.js`, and `js/interop-client.js`.

---

## Existing modules (baseline)

| Area | Primary files | Storage | External send/receive |
|------|---------------|---------|------------------------|
| Lab orders | `lab-order.html`, `select-lab-orders.html`, `js/patients.js` (LAB_TESTS) | `orders.type='lab'` | None |
| Lab results | `js/lab-results-manager.js`, `lab-result-entry.html` | `orders.results` JSONB | None |
| Imaging orders | `imaging-order.html`, `select-imaging-orders.html` | `orders.type='imaging'` | None |
| Imaging results | File attach (PDF/JPG/DICOM file) | `orders.results` / attachments | No DICOMweb/PACS |
| Prescriptions | `prescription.html`, `js/prescriptions.js`, `js/prescriptions-supabase.js` | `prescriptions` | In-house pharmacy or print only |
| Data exchange | `js/interoperability.js` | localStorage | CSV import; simplified HL7 ADT export (not ORM/ORU) |

### Netlify functions (pre-upgrade)

| Function | Purpose | Clinical interop |
|----------|---------|------------------|
| `secure-supabase.js` | Privileged RPC proxy | No |
| `appointment-reminders-daily.js` | Cron reminders | No |
| Others | CSP, email, legal | No |

### Libraries (pre-upgrade)

`package.json` has **no** HL7, FHIR, or DICOM dependencies. Stack: static HTML/JS + Supabase + Netlify Functions.

---

## Standards gap matrix

| Standard | Required for Canada | Pre-upgrade status | Post-upgrade (today) |
|----------|---------------------|--------------------|----------------------|
| HL7 v2 ORM^O01 / OML^O21 | Lab/imaging orders to LIS/RIS | ❌ Not implemented | ✅ Generator/parser + MLLP client in `lib/interop/hl7/` |
| HL7 v2 ORU^R01 | Lab results inbound | ❌ Not implemented | ✅ Parser + ingest adapter |
| HL7 v2 ACK | Transport reliability | ❌ | ✅ ACK generator/parser |
| MLLP | OLIS/LIS transport | ❌ | ✅ Node MLLP framing + TCP client |
| FHIR R4 ServiceRequest | Orders (Infoway/OLIS FHIR) | ❌ | ✅ Resource builder + client |
| FHIR R4 DiagnosticReport + Observation | Lab results | ❌ | ✅ Resource builder + ingest |
| FHIR R4 MedicationRequest | eRx | ❌ | ✅ Resource builder + Infoway adapter stub |
| FHIR R4 ImagingStudy | Imaging metadata | ❌ | ✅ Resource builder |
| DICOMweb QIDO/WADO/STOW | PACS images | ❌ | ✅ REST client in `lib/interop/dicom/` |
| DICOM C-FIND/C-MOVE | Legacy PACS | ❌ | ⚠️ Config + proxy stub (full DIMSE needs gateway appliance) |
| LOINC / pCLOCD | Lab codes (Canada) | ❌ CPT only | ✅ Mapping layer + config |
| CCDD | Drug codes (Canada) | ❌ Local drug list | ✅ Mapping layer + config |
| SNOMED CT | Imaging/body site | ❌ | ✅ Mapping layer + config |
| OAuth2 / consent | Infoway/OLIS | Partial (Supabase Auth) | ✅ Interop gateway auth + audit |
| Patient PHN matching | Ontario OLIS | ❌ | ✅ `patient_identifiers` + matching module |
| PrescribeIT / Infoway Rx network | National eRx | ❌ | ⚠️ Adapter + config (requires Infoway credentials) |

**Legend:** ✅ Implemented foundation | ⚠️ Adapter/config ready; production credentials & conformance testing still required | ❌ Missing

---

## Workflow gaps (detailed)

### Lab

| Step | Before | Gap | After (today) |
|------|--------|-----|---------------|
| Order from UI | Saves to `orders` | No HL7/FHIR outbound | `transmitLabOrder()` on save |
| Send to external LIS | Manual / external-lab-orders.html list | No ORM/ServiceRequest | HL7 ORM^O01 or FHIR ServiceRequest via gateway |
| Receive results | Manual entry in lab-result-entry | No ORU/DiagnosticReport ingest | `ingestLabResult()` from gateway webhook |
| Terminology | CPT in catalog | No LOINC/pCLOCD | Config mappings + adapter enrichment |
| Critical values | Not standardized | No HL7/FHIR flag handling | Observation interpretation + UI alert hook |

### Imaging

| Step | Before | Gap | After (today) |
|------|--------|-----|---------------|
| Order | `orders` type imaging | No ORM to RIS | HL7 ORM + FHIR ServiceRequest |
| Report | PDF/text attach | No structured report | DiagnosticReport ingest |
| Images | .dcm file upload | No DICOMweb | STOW-RS upload + WADO-RS viewer link in chart |
| PACS query | None | No QIDO/C-FIND | QIDO-RS client + config |

### Prescriptions

| Step | Before | Gap | After (today) |
|------|--------|-----|---------------|
| Sign Rx | `prescriptions` row | No network transmit | MedicationRequest + Infoway adapter |
| Drug codes | DRUG_DATABASE text | No CCDD DIN | CCDD mapping in config |
| Pharmacy feedback | In-house status only | No external dispense ack | Inbound MedicationDispense handler (stub) |
| PrescribeIT | N/A | Not integrated | Config placeholder for Infoway open standard April 2026 |

---

## Database gaps

| Need | Before | Added |
|------|--------|-------|
| Message audit / retry queue | None | `interop_messages` |
| Provincial IDs (PHN, etc.) | Ad hoc on patient row | `patient_identifiers` |
| Per-org adapter config | None | `interop_endpoints` + `config/interoperability.json` |

Migration: `supabase/migrations/20260611000000_interoperability_tables.sql`

---

## Security & compliance gaps

| Control | Before | After |
|---------|--------|-------|
| Interop audit trail | General audit_logs | `interop_messages` + dedicated audit events |
| OAuth2 for FHIR | N/A | Client credentials in gateway (env vars) |
| Consent for OLIS query | N/A | Config flag + consent record hook |
| Encryption in transit | HTTPS only | MLLP over TLS config; FHIR HTTPS |
| PHI in logs | Risk in console.log | Gateway redacts payloads in logs |

---

## Production readiness (honest assessment)

**Not production-ready for live OLIS/PrescribeIT today** without:

1. Infoway / provincial onboarding and conformance testing  
2. Production MLLP endpoints and certificates (often via integration engine)  
3. LOINC/pCLOCD/CCDD code sets licensed and loaded (not shipped in repo)  
4. DIMSE (C-FIND/C-MOVE) typically requires a DICOM gateway appliance—we provide DICOMweb + proxy config  
5. Legal BAAs and patient consent workflows per province  

**Ready today:** Standards-compliant message generation/parsing, configurable adapters, gateway API, test suite, chart attach workflows, and extensibility layer for partner onboarding.

---

## File map (new interoperability layer)

```
lib/interop/
  hl7/          parser, generator, mllp, ack
  fhir/         resources, client, handlers
  dicom/        dicomweb-client
  terminology/  loinc-pclocd, ccdd, snomed
  adapters/     lab, imaging, rx
  patient-matching.js
  config.js
  index.js

config/interoperability.json
config/interoperability.ontario.example.json

netlify/functions/interop-gateway.js

js/interop-client.js
js/interop-hooks.js
interop-dashboard.html

tests/interop/*.test.js
tests/samples/hl7|fhir|dicom/

MEDIFORGE-INTEROPERABILITY-DOCS.md
```

---

## Recommended next steps (post-foundation)

1. Load provincial LOINC/pCLOCD/CCDD code files into Supabase or CDN (license-dependent)  
2. Complete Infoway FHIR conformance for Ontario OLIS test environment  
3. Deploy MLLP listener on hardened host or use Mirth/Integration engine with MediForge webhook  
4. Pilot PHN patient matching with real Ontario test patients  
5. UI: result review queue for inbound ORU/DiagnosticReport with manual reconcile  
